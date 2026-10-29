"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { challengeNeedsReview, parseChallenge } from "@/lib/challenges/model";
import { loadOpenChallenge, milestoneGate } from "@/lib/challenges/open";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeAnswers, type AnswerKey } from "@/lib/submissions/grading";
import { submissionInputSchema } from "@/lib/submissions/input";
import { attemptState, isEditable, maxAttemptsFor } from "@/lib/submissions/rules";
import { isTestChallenge, nextTestAttempt, testingState } from "@/lib/submissions/testing";

export type SubmitResult =
  | { ok: true; submissionId: string; status: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);

/**
 * Create a submission for the signed-in user. Everything that matters — visibility,
 * attempts, validation, grading, status — is decided here with the service role; the
 * client only supplies answers and paths to files it uploaded to its own folder.
 *
 * A tester on a DRAFT challenge makes a test attempt instead: saved with `is_test`, numbered on its own (no limit),
 * published on the spot (nobody reviews a test) and never counted anywhere.
 */
export async function submitChallenge(slugInput: string, rawInput: unknown): Promise<SubmitResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.track) return { ok: false, error: "Choose your track first." };

  const slug = slugSchema.safeParse(slugInput);
  if (!slug.success) return { ok: false, error: "Challenge not found." };

  const admin = createAdminClient();
  const row = await loadOpenChallenge(admin, slug.data, profile.track, profile.is_tester);
  if (!row || row.type === "acknowledge") return { ok: false, error: "This challenge isn't open for submissions." };
  const locked = await milestoneGate(admin, row, { id: user.id, track: profile.track, is_tester: profile.is_tester });
  if (locked) return { ok: false, error: locked };
  const challenge = parseChallenge(row);
  // Instant feedback is scored from the tries counted as the learner goes (checkInstantAnswer), never in one go.
  if (challenge.feedback_mode === "instant") return { ok: false, error: "This quiz checks each answer as you go. Reload the page." };
  const testing = isTestChallenge(row.status);

  const { data: previous, error: prevError } = await admin
    .from("submissions")
    .select("attempt,status,final_score,max_score")
    .eq("user_id", user.id)
    .eq("challenge_slug", challenge.slug)
    .eq("is_test", testing);
  if (prevError) return { ok: false, error: "Couldn't check your previous attempts. Please try again." };
  const state = testing ? testingState(previous) : attemptState(previous, maxAttemptsFor(challenge.feedback_mode));
  if (!state.canSubmit) return { ok: false, error: state.reason ?? "You can't submit right now." };

  const parsed = submissionInputSchema(challenge, user.id).safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const missing = await checkScreenshots(admin, `${user.id}/${challenge.slug}`, input.imagePaths);
  if (missing) return missing;

  const graded = await autoGrade(admin, challenge, input.answers);
  if (!graded.ok) return graded;
  const { autoScore } = graded;

  // A test attempt is never reviewed: published at once, with the auto-graded part marked.
  const reviewed = !testing && challengeNeedsReview(challenge);
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("submissions")
    .insert({
      user_id: user.id,
      challenge_slug: challenge.slug,
      challenge_version: challenge.version,
      attempt: testing ? nextTestAttempt(previous) : state.attemptsUsed + 1,
      is_test: testing,
      answers: input.answers,
      image_paths: input.imagePaths,
      figma_url: input.figmaUrl,
      reflection: input.reflection,
      status: reviewed ? "submitted" : "published",
      auto_score: autoScore,
      final_score: reviewed ? null : autoScore,
      max_score: challenge.points,
      published_at: reviewed ? null : now,
    })
    .select("id,status")
    .single();
  if (insertError) {
    // 23505 = unique (user, challenge, attempt): a parallel submit won the race.
    return {
      ok: false,
      error: insertError.code === "23505" ? "This attempt was already submitted. Refresh the page." : "Couldn't save your submission. Please try again.",
    };
  }

  // The submission replaces the draft. Best effort: a draft left behind is harmless (the next save overwrites it, and
  // a challenge with no attempts left never shows "In progress").
  await admin.from("submission_drafts").delete().eq("user_id", user.id).eq("challenge_slug", challenge.slug);

  revalidatePath("/", "layout");
  return { ok: true, submissionId: inserted.id, status: inserted.status };
}

type AdminClient = ReturnType<typeof createAdminClient>;
type Failure = { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Every referenced screenshot must really exist in the user's folder for this challenge. */
async function checkScreenshots(admin: AdminClient, folder: string, paths: string[]): Promise<Failure | null> {
  if (paths.length === 0) return null;
  const { data: files, error } = await admin.storage.from("submissions").list(folder, { limit: 1000 });
  if (error) return { ok: false, error: "Couldn't verify your screenshots. Please try again." };
  const names = new Set(files.map((f) => `${folder}/${f.name}`));
  if (!paths.every((p) => names.has(p))) {
    return { ok: false, error: "A screenshot didn't finish uploading. Please re-add it.", fieldErrors: { imagePaths: "Upload missing." } };
  }
  return null;
}

/** The auto-graded part of the score, from the answer key (service role only). */
async function autoGrade(
  admin: AdminClient,
  challenge: ReturnType<typeof parseChallenge>,
  answers: Parameters<typeof gradeAnswers>[2],
): Promise<{ ok: true; autoScore: number } | Failure> {
  const { data: keyRow, error } = await admin
    .from("challenge_keys")
    .select("answer_key")
    .eq("challenge_slug", challenge.slug)
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't grade your answers. Please try again." };
  const { autoScore } = gradeAnswers(challenge.questions, (keyRow?.answer_key ?? {}) as AnswerKey, answers);
  return { ok: true, autoScore };
}

export type EditResult = { ok: true } | Failure;

const submissionIdSchema = z.uuid();

/**
 * Change a submission that is still waiting for review (submitted, or AI-reviewed but not yet approved). The same
 * checks as a submit, then edit_submission() swaps the content in one transaction: back to `submitted`, the AI score
 * and feedback cleared (the next /evaluate scores the new version). Once an admin has approved it or asked for a
 * resubmission it's locked; test and imported attempts are never edited.
 */
export async function editSubmission(submissionIdInput: string, rawInput: unknown): Promise<EditResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.track) return { ok: false, error: "Choose your track first." };

  const id = submissionIdSchema.safeParse(submissionIdInput);
  if (!id.success) return { ok: false, error: "Submission not found." };

  const admin = createAdminClient();
  const { data: sub, error: subError } = await admin
    .from("submissions")
    .select("id,challenge_slug,status,is_test,is_imported")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (subError) return { ok: false, error: "Couldn't load your submission. Please try again." };
  if (!sub) return { ok: false, error: "Submission not found." };
  if (!isEditable(sub)) return { ok: false, error: LOCKED };

  const row = await loadOpenChallenge(admin, sub.challenge_slug, profile.track, profile.is_tester);
  if (!row || row.type === "acknowledge") return { ok: false, error: "This challenge isn't open for submissions." };
  const challenge = parseChallenge(row);
  if (challenge.feedback_mode === "instant" || !challengeNeedsReview(challenge)) return { ok: false, error: LOCKED };

  const parsed = submissionInputSchema(challenge, user.id).safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const missing = await checkScreenshots(admin, `${user.id}/${challenge.slug}`, input.imagePaths);
  if (missing) return missing;
  const graded = await autoGrade(admin, challenge, input.answers);
  if (!graded.ok) return graded;

  const { error } = await admin.rpc("edit_submission", {
    p_submission: sub.id,
    p_user: user.id,
    p_answers: input.answers,
    p_image_paths: input.imagePaths,
    p_figma_url: input.figmaUrl ?? "",
    p_reflection: input.reflection ?? "",
    p_auto_score: graded.autoScore,
    p_challenge_version: challenge.version,
    p_max_score: challenge.points,
  });
  // 42501: reviewed between the check above and now.
  if (error) return { ok: false, error: error.code === "42501" ? LOCKED : "Couldn't save your changes. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}

const LOCKED = "This submission has been reviewed, so it can't be changed any more.";

export type AcknowledgeResult = { ok: true; acknowledgedAt: string } | { ok: false; error: string };

/**
 * "I've read and understood" for an acknowledge challenge. Records who confirmed, when, and
 * against which version. Idempotent: confirming twice keeps the first timestamp.
 */
export async function acknowledgeChallenge(slugInput: string): Promise<AcknowledgeResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.track) return { ok: false, error: "Choose your track first." };

  const slug = slugSchema.safeParse(slugInput);
  if (!slug.success) return { ok: false, error: "Challenge not found." };

  const admin = createAdminClient();
  const row = await loadOpenChallenge(admin, slug.data, profile.track);
  if (!row || row.type !== "acknowledge") return { ok: false, error: "This challenge can't be acknowledged." };

  const { error } = await admin
    .from("acknowledgements")
    .upsert(
      { user_id: user.id, challenge_slug: row.slug, challenge_version: row.version },
      { onConflict: "user_id,challenge_slug", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: "Couldn't save your confirmation. Please try again." };

  const { data: ack, error: readError } = await admin
    .from("acknowledgements")
    .select("acknowledged_at")
    .eq("user_id", user.id)
    .eq("challenge_slug", row.slug)
    .single();
  if (readError) return { ok: false, error: "Couldn't save your confirmation. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true, acknowledgedAt: ack.acknowledged_at };
}
