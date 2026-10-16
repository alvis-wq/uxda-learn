import "server-only";
import type { PublicQuestion } from "@/lib/content/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnswerKey } from "@/lib/submissions/grading";
import { attemptSeed, shuffleForAttempt } from "@/lib/submissions/shuffle";

/**
 * The questions as this learner's attempt shows them: in the attempt's own order (see shuffle.ts). The key is read
 * only to keep an order question from starting in the right order, and it stays on the server.
 */
export async function questionsForAttempt(
  challenge: { slug: string; questions: PublicQuestion[] },
  userId: string,
  attempt: number,
  testing: boolean,
): Promise<PublicQuestion[]> {
  let key: AnswerKey = {};
  if (challenge.questions.some((q) => q.kind === "order")) {
    // The key table has no RLS policies: only the service role reads it.
    const { data } = await createAdminClient().from("challenge_keys").select("answer_key").eq("challenge_slug", challenge.slug).maybeSingle();
    key = (data?.answer_key ?? {}) as AnswerKey;
  }
  return shuffleForAttempt(challenge.questions, attemptSeed(userId, challenge.slug, attempt, testing), key);
}
