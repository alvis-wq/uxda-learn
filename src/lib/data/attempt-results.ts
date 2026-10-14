import "server-only";
import type { Challenge } from "@/lib/challenges/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AnswerKey } from "@/lib/submissions/grading";
import {
  answerReveal,
  questionResults,
  REVEAL_ALL,
  type AnswerReveal,
  type QuestionResult,
} from "@/lib/submissions/results";

/** What the attempt page shows about the auto-graded questions. */
export type AttemptResultsView =
  | { state: "none" }
  /** The challenge changed after this attempt; today's key no longer matches what was asked. */
  | { state: "outdated" }
  | { state: "ready"; results: QuestionResult[]; reveal: AnswerReveal };

type SubmissionForResults = {
  challenge_slug: string;
  challenge_version: number;
  answers: unknown;
};

async function build(sub: SubmissionForResults, challenge: Challenge | null, reveal: () => Promise<AnswerReveal>) {
  if (!challenge || !challenge.questions.some((q) => q.kind !== "text")) return { state: "none" } as const;
  if (challenge.version !== sub.challenge_version) return { state: "outdated" } as const;
  const [{ data: keyRow, error }, revealState] = await Promise.all([
    // The key table has no RLS policies: only the service role reads it, and only here on the server.
    createAdminClient().from("challenge_keys").select("answer_key").eq("challenge_slug", sub.challenge_slug).maybeSingle(),
    reveal(),
  ]);
  if (error || !keyRow) return { state: "none" } as const;
  const results = questionResults(
    challenge.questions,
    keyRow.answer_key as AnswerKey,
    (sub.answers ?? {}) as Record<string, unknown>,
    revealState,
  );
  return { state: "ready", results, reveal: revealState } as const;
}

/**
 * Per-question results for one of the signed-in learner's own attempts. The right answers are included only when
 * `answerReveal` says so (full marks on the challenge, or all attempts used), judged on their attempts as of now.
 */
export function getLearnerAttemptResults(
  userId: string,
  sub: SubmissionForResults,
  challenge: Challenge | null,
): Promise<AttemptResultsView> {
  return build(sub, challenge, async () => {
    const { data } = await (await createClient())
      .from("submissions")
      .select("status,final_score,max_score")
      .eq("user_id", userId)
      .eq("challenge_slug", sub.challenge_slug);
    return answerReveal(data ?? []);
  });
}

/** The same for an admin reviewing a submission: always with the right answers. */
export function getAdminAttemptResults(sub: SubmissionForResults, challenge: Challenge | null): Promise<AttemptResultsView> {
  return build(sub, challenge, async () => REVEAL_ALL);
}
