import type { PublicQuestion } from "@/lib/content/schema";

export type AnswerKey = Record<string, string | string[]>;
export type Answers = Record<string, string | string[]>;

/**
 * Whether one answer to an auto-graded question is right. Multi is an exact set match; order an exact sequence; match
 * an exact set of item=category pairs (so every item must be on its category). All of them all-or-nothing.
 */
export function isCorrectAnswer(q: PublicQuestion, expected: string | string[] | undefined, given: string | string[] | undefined): boolean {
  if (q.kind === "text") return false;
  if (q.kind === "single") return typeof expected === "string" && given === expected;
  if (!Array.isArray(expected) || !Array.isArray(given)) return false;
  if (q.kind === "order") return given.length === expected.length && given.every((v, i) => v === expected[i]);
  const a = [...new Set(given)].sort();
  const b = [...expected].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Auto-grade single/multi/order/match questions (all-or-nothing each, see isCorrectAnswer).
 * Text questions score 0 here; they're reviewed later.
 */
export function gradeAnswers(questions: PublicQuestion[], key: AnswerKey, answers: Answers) {
  const results = questions
    .filter((q) => q.kind !== "text")
    .map((q) => {
      const correct = isCorrectAnswer(q, key[q.id], answers[q.id]);
      return { id: q.id, correct, points: correct ? q.points : 0, max: q.points };
    });
  return { autoScore: results.reduce((s, r) => s + r.points, 0), results };
}

/**
 * Instant feedback: what a question earns once it's solved, by the number of tries it took. Full points on the first
 * try, half on the second, nothing after that; rounded to half points.
 */
export function instantPoints(points: number, tries: number): number {
  const share = tries <= 1 ? 1 : tries === 2 ? 0.5 : 0;
  return Math.round(points * share * 2) / 2;
}

/** The total of an instant-mode run, from the tries per question id (a question with no entry earns nothing). */
export function instantScore(questions: PublicQuestion[], tries: Record<string, number>): number {
  return questions.reduce((sum, q) => sum + (tries[q.id] ? instantPoints(q.points, tries[q.id]) : 0), 0);
}
