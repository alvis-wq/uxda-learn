import type { PublicQuestion } from "@/lib/content/schema";

/**
 * Instant feedback: each answer is checked on the server as the learner goes, and they move on only once it's right.
 * The run in progress lives in submission_drafts.instant_tries, written only by the record_instant_try function
 * (service role): {"test": bool, "questions": {"<id>": {"tries": n, "solved": bool}}}. Scoring is in grading.ts
 * (instantPoints), the one-attempt rule in rules.ts (maxAttemptsFor).
 */
export type InstantQuestionState = { tries: number; solved: boolean };
export type InstantRun = Record<string, InstantQuestionState>;

/**
 * The run for this kind of attempt (a tester's test run or a real one), from the stored JSON. Never trusts it: a
 * malformed entry is skipped, and a run of the other kind (e.g. a test run left when the challenge was published)
 * counts as no run at all.
 */
export function parseInstantRun(raw: unknown, testing: boolean): InstantRun {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const { test, questions } = raw as { test?: unknown; questions?: unknown };
  if (test !== testing || !questions || typeof questions !== "object" || Array.isArray(questions)) return {};
  const out: InstantRun = {};
  for (const [id, v] of Object.entries(questions as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const { tries, solved } = v as { tries?: unknown; solved?: unknown };
    if (typeof tries === "number" && Number.isInteger(tries) && tries > 0 && typeof solved === "boolean") out[id] = { tries, solved };
  }
  return out;
}

/** Every question of the challenge is solved in the run. */
export function isRunComplete(questions: readonly PublicQuestion[], run: InstantRun): boolean {
  return questions.length > 0 && questions.every((q) => run[q.id]?.solved);
}

/** The tries behind each solved question, as stored with the attempt (submissions.question_tries). */
export function solvedTries(questions: readonly PublicQuestion[], run: InstantRun): Record<string, number> {
  return Object.fromEntries(questions.flatMap((q) => (run[q.id]?.solved ? [[q.id, run[q.id].tries]] : [])));
}

/** "1st try", "2nd try", "3rd try", "4th try". */
export function tryLabel(tries: number): string {
  const suffix = tries % 100 >= 11 && tries % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[tries % 10] ?? "th";
  return `${tries}${suffix} try`;
}
