import type { PublicQuestion } from "@/lib/content/schema";
import { gradeAnswers, type AnswerKey, type Answers } from "./grading";
import { MAX_ATTEMPTS, type AttemptSummary } from "./rules";

/**
 * Whether a learner may see the right answers to the questions they got wrong. Decided on the server, from their
 * attempts on the challenge: with up to three attempts, showing the key earlier would let them copy it into the
 * next one. Either full marks on the challenge or every attempt used opens it.
 */
export type AnswerReveal = { reveal: true } | { reveal: false; attemptsLeft: number };

/** Admins reviewing a submission always see the key. */
export const REVEAL_ALL: AnswerReveal = { reveal: true };

export function answerReveal(attempts: Pick<AttemptSummary, "status" | "final_score" | "max_score">[]): AnswerReveal {
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts.length);
  const fullMarks = attempts.some(
    (a) => a.status === "published" && a.final_score !== null && Number(a.max_score) > 0 && Number(a.final_score) >= Number(a.max_score),
  );
  return fullMarks || attemptsLeft === 0 ? REVEAL_ALL : { reveal: false, attemptsLeft };
}

/** The hint under a wrong answer while the key is still hidden. */
export function tryAgainMessage(attemptsLeft: number): string {
  return `Try again to find the right answer — ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`;
}

export type QuestionResult = {
  questionId: string;
  correct: boolean;
  /**
   * Option ids of the right answer. Set ONLY for a wrong answer when `reveal` allows it; otherwise null, so the key
   * never leaves the server before the learner is entitled to it.
   */
  correctOptionIds: string[] | null;
};

/** Stored answers are untrusted JSON: keep only strings and string lists. */
function toAnswers(raw: Record<string, unknown>): Answers {
  const out: Answers = {};
  for (const [id, v] of Object.entries(raw)) {
    if (typeof v === "string") out[id] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[id] = v as string[];
  }
  return out;
}

/** Per-question marks for the auto-graded (single / multi) questions, in question order. */
export function questionResults(
  questions: PublicQuestion[],
  key: AnswerKey,
  rawAnswers: Record<string, unknown>,
  reveal: AnswerReveal,
): QuestionResult[] {
  const { results } = gradeAnswers(questions, key, toAnswers(rawAnswers));
  return results.map(({ id, correct }) => {
    const expected = key[id];
    const ids = typeof expected === "string" ? [expected] : Array.isArray(expected) ? [...expected] : null;
    return { questionId: id, correct, correctOptionIds: !correct && reveal.reveal && ids ? ids : null };
  });
}
