import type { PublicQuestion } from "@/lib/content/schema";
import { gradeAnswers, instantPoints, type AnswerKey, type Answers } from "./grading";
import { MAX_ATTEMPTS, type AttemptSummary } from "./rules";

/**
 * Whether a learner may see the right answers to the questions they got wrong. Decided on the server, from their
 * attempts on the challenge: with up to three attempts, showing the key earlier would let them copy it into the
 * next one. Either full marks on the challenge or every attempt used opens it.
 */
export type AnswerReveal = { reveal: true } | { reveal: false; attemptsLeft: number };

/** Admins reviewing a submission always see the key. */
export const REVEAL_ALL: AnswerReveal = { reveal: true };

export function answerReveal(
  attempts: Pick<AttemptSummary, "status" | "final_score" | "max_score">[],
  maxAttempts = MAX_ATTEMPTS,
): AnswerReveal {
  const attemptsLeft = Math.max(0, maxAttempts - attempts.length);
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
  /** Why the right answer is right: for a correct answer, or once the key may be shown; otherwise null. */
  explanation: string | null;
  /** An instant-feedback attempt: the tries it took and the points they earned; null in final mode. */
  instant: { tries: number; points: number; max: number } | null;
};

/** Stored explanations (challenge_keys.explanations): only string values. */
export function toExplanations(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Stored per-question tries (submissions.question_tries) are untrusted JSON: keep only positive whole numbers. */
export function toQuestionTries(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isInteger(v) && v > 0) out[id] = v;
  }
  return out;
}

/** Stored answers are untrusted JSON: keep only strings and string lists. */
function toAnswers(raw: Record<string, unknown>): Answers {
  const out: Answers = {};
  for (const [id, v] of Object.entries(raw)) {
    if (typeof v === "string") out[id] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[id] = v as string[];
  }
  return out;
}

/** Per-question marks for the auto-graded questions, in question order. */
export function questionResults(
  questions: PublicQuestion[],
  key: AnswerKey,
  rawAnswers: Record<string, unknown>,
  reveal: AnswerReveal,
  extra: { explanations?: Record<string, string>; questionTries?: Record<string, number> | null } = {},
): QuestionResult[] {
  const { results } = gradeAnswers(questions, key, toAnswers(rawAnswers));
  const tries = extra.questionTries ?? null;
  return results.map(({ id, correct, max }) => {
    const expected = key[id];
    const ids = typeof expected === "string" ? [expected] : Array.isArray(expected) ? [...expected] : null;
    const n = tries?.[id];
    return {
      questionId: id,
      correct,
      correctOptionIds: !correct && reveal.reveal && ids ? ids : null,
      explanation: correct || reveal.reveal ? (extra.explanations?.[id] ?? null) : null,
      instant: tries && n ? { tries: n, points: instantPoints(max, n), max } : null,
    };
  });
}
