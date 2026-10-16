"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { parseChallenge } from "@/lib/challenges/model";
import { loadOpenChallenge, milestoneGate } from "@/lib/challenges/open";
import { createAdminClient } from "@/lib/supabase/admin";
import { instantScore, isCorrectAnswer, type AnswerKey } from "@/lib/submissions/grading";
import { answerSchema } from "@/lib/submissions/input";
import { isRunComplete, parseInstantRun, solvedTries } from "@/lib/submissions/instant";
import { toExplanations } from "@/lib/submissions/results";
import { attemptState, maxAttemptsFor } from "@/lib/submissions/rules";
import { isTestChallenge, nextTestAttempt, testingState } from "@/lib/submissions/testing";

export type InstantCheckResult =
  | { ok: true; correct: false }
  /** `submissionId`: that was the last question, and the attempt is now published. */
  | { ok: true; correct: true; explanation: string | null; submissionId: string | null }
  /** `stale`: the challenge changed since the page loaded. */
  | { ok: false; error: string; stale?: boolean };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
const inputSchema = z.object({
  version: z.number().int().positive(),
  questionId: z.string().min(1).max(100),
  answer: z.union([z.string().max(200), z.array(z.string().max(200)).max(200)]),
});

/**
 * Instant feedback: check ONE answer of an instant-mode quiz and count the try. Everything is decided here with the
 * service role, as for a submission: who may act, which question, whether it's right, how many tries it took.
 * The browser gets back only right/wrong, and the explanation once it is right; never the key.
 *
 * Tries are counted in the learner's draft row by record_instant_try (atomic; a solved question is never counted
 * again). When the last question is solved, the attempt is published straight away, scored from the tries: full
 * points on the first try, half on the second, nothing after (grading.ts). One real attempt per challenge
 * (rules.ts); a tester's test attempts on a draft are unlimited and never count.
 */
export async function checkInstantAnswer(slugInput: string, rawInput: unknown): Promise<InstantCheckResult> {
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
  if (challenge.feedback_mode !== "instant") return { ok: false, error: "This challenge isn't checked as you go." };
  const testing = isTestChallenge(row.status);

  const input = inputSchema.safeParse(rawInput);
  if (!input.success) return { ok: false, error: "Couldn't check your answer." };
  if (input.data.version !== challenge.version) {
    return { ok: false, stale: true, error: "This challenge was updated. Reload the page to continue." };
  }
  const question = challenge.questions.find((q) => q.id === input.data.questionId);
  if (!question || question.kind === "text") return { ok: false, error: "Couldn't check your answer." };
  const answer = answerSchema(question).safeParse(input.data.answer);
  if (!answer.success) return { ok: false, error: answer.error.issues[0]?.message ?? "Couldn't check your answer." };

  const { data: previous, error: prevError } = await admin
    .from("submissions")
    .select("attempt,status,final_score,max_score")
    .eq("user_id", user.id)
    .eq("challenge_slug", challenge.slug)
    .eq("is_test", testing);
  if (prevError) return { ok: false, error: "Couldn't check your answer. Please try again." };
  const state = testing ? testingState(previous) : attemptState(previous, maxAttemptsFor(challenge.feedback_mode));
  if (!state.canSubmit) return { ok: false, error: state.reason ?? "You can't submit right now." };

  const { data: keyRow, error: keyError } = await admin
    .from("challenge_keys")
    .select("answer_key,explanations")
    .eq("challenge_slug", challenge.slug)
    .maybeSingle();
  if (keyError || !keyRow) return { ok: false, error: "Couldn't check your answer. Please try again." };
  const key = keyRow.answer_key as AnswerKey;
  const correct = isCorrectAnswer(question, key[question.id], answer.data);

  const { data: rawRun, error: tryError } = await admin.rpc("record_instant_try", {
    p_user: user.id,
    p_challenge: challenge.slug,
    p_version: challenge.version,
    p_question: question.id,
    p_correct: correct,
    p_is_test: testing,
  });
  if (tryError) return { ok: false, error: "Couldn't check your answer. Please try again." };
  const run = parseInstantRun(rawRun, testing);
  // An answer to a question solved earlier (a second tab, a retried request) still reads as solved.
  const solved = run[question.id]?.solved ?? false;
  if (!solved) return { ok: true, correct: false };

  const explanation = toExplanations(keyRow.explanations)[question.id] ?? null;
  const solvedCount = challenge.questions.filter((q) => run[q.id]?.solved).length;
  if (!isRunComplete(challenge.questions, run)) {
    // Progress for "In progress" lists (the question the learner is on). Best effort: nothing depends on it.
    await admin
      .from("submission_drafts")
      .update({ current_step: Math.min(solvedCount + 1, challenge.questions.length) })
      .eq("user_id", user.id)
      .eq("challenge_slug", challenge.slug);
    return { ok: true, correct: true, explanation, submissionId: null };
  }

  // The last question: publish the attempt. Every answer ended up right, so the answers stored are the key's.
  const tries = solvedTries(challenge.questions, run);
  const score = instantScore(challenge.questions, tries);
  const answers = Object.fromEntries(challenge.questions.flatMap((q) => (key[q.id] === undefined ? [] : [[q.id, key[q.id]]])));
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("submissions")
    .insert({
      user_id: user.id,
      challenge_slug: challenge.slug,
      challenge_version: challenge.version,
      attempt: testing ? nextTestAttempt(previous) : state.attemptsUsed + 1,
      is_test: testing,
      answers,
      image_paths: [],
      figma_url: null,
      reflection: null,
      status: "published",
      auto_score: score,
      final_score: score,
      max_score: challenge.points,
      question_tries: tries,
      published_at: now,
    })
    .select("id")
    .single();
  if (insertError) {
    // 23505 = unique (user, challenge, attempt): a parallel check already published this run.
    return {
      ok: false,
      error: insertError.code === "23505" ? "This attempt was already submitted. Refresh the page." : "Couldn't save your result. Please try again.",
    };
  }

  // The attempt replaces the run. Best effort, as for a submission: a real attempt can't be made again anyway.
  await admin.from("submission_drafts").delete().eq("user_id", user.id).eq("challenge_slug", challenge.slug);

  revalidatePath("/", "layout");
  return { ok: true, correct: true, explanation, submissionId: inserted.id };
}
