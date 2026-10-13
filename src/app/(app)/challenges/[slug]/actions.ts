"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { challengeNeedsReview, parseChallenge } from "@/lib/challenges/model";
import { loadOpenChallenge } from "@/lib/challenges/open";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeAnswers, type AnswerKey } from "@/lib/submissions/grading";
import { submissionInputSchema } from "@/lib/submissions/input";
import { attemptState } from "@/lib/submissions/rules";

export type SubmitResult =
  | { ok: true; submissionId: string; status: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);

/**
 * Create a submission for the signed-in user. Everything that matters — visibility,
 * attempts, validation, grading, status — is decided here with the service role; the
 * client only supplies answers and paths to files it uploaded to its own folder.
 */
export async function submitChallenge(slugInput: string, rawInput: unknown): Promise<SubmitResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.track) return { ok: false, error: "Choose your track first." };

  const slug = slugSchema.safeParse(slugInput);
  if (!slug.success) return { ok: false, error: "Challenge not found." };

  const admin = createAdminClient();
  const row = await loadOpenChallenge(admin, slug.data, profile.track);
  if (!row || row.type === "acknowledge") return { ok: false, error: "This challenge isn't open for submissions." };
  const challenge = parseChallenge(row);

  const { data: previous, error: prevError } = await admin
    .from("submissions")
    .select("attempt,status,final_score,max_score")
    .eq("user_id", user.id)
    .eq("challenge_slug", challenge.slug);
  if (prevError) return { ok: false, error: "Couldn't check your previous attempts. Please try again." };
  const state = attemptState(previous);
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

  // Every referenced screenshot must really exist in the user's folder for this challenge.
  if (input.imagePaths.length > 0) {
    const folder = `${user.id}/${challenge.slug}`;
    const { data: files, error } = await admin.storage.from("submissions").list(folder, { limit: 1000 });
    if (error) return { ok: false, error: "Couldn't verify your screenshots. Please try again." };
    const names = new Set(files.map((f) => `${folder}/${f.name}`));
    if (!input.imagePaths.every((p) => names.has(p))) {
      return { ok: false, error: "A screenshot didn't finish uploading. Please re-add it.", fieldErrors: { imagePaths: "Upload missing." } };
    }
  }

  const { data: keyRow, error: keyError } = await admin
    .from("challenge_keys")
    .select("answer_key")
    .eq("challenge_slug", challenge.slug)
    .maybeSingle();
  if (keyError) return { ok: false, error: "Couldn't grade your answers. Please try again." };
  const { autoScore } = gradeAnswers(challenge.questions, (keyRow?.answer_key ?? {}) as AnswerKey, input.answers);

  const reviewed = challengeNeedsReview(challenge);
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("submissions")
    .insert({
      user_id: user.id,
      challenge_slug: challenge.slug,
      challenge_version: challenge.version,
      attempt: state.attemptsUsed + 1,
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
