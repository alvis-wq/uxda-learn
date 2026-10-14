import type { PublicQuestion } from "@/lib/content/schema";

export type AnswerKey = Record<string, string | string[]>;
export type Answers = Record<string, string | string[]>;

/**
 * Auto-grade single/multi/order questions. Multi is all-or-nothing (exact set match); order is all-or-nothing too
 * (exact sequence).
 * Text questions score 0 here; they're reviewed later.
 */
export function gradeAnswers(questions: PublicQuestion[], key: AnswerKey, answers: Answers) {
  const results = questions
    .filter((q) => q.kind !== "text")
    .map((q) => {
      const expected = key[q.id];
      const given = answers[q.id];
      let correct = false;
      if (q.kind === "single") {
        correct = typeof expected === "string" && given === expected;
      } else if (q.kind === "order") {
        correct = Array.isArray(expected) && Array.isArray(given) && given.length === expected.length && given.every((v, i) => v === expected[i]);
      } else if (Array.isArray(expected) && Array.isArray(given)) {
        const a = [...new Set(given)].sort();
        const b = [...expected].sort();
        correct = a.length === b.length && a.every((v, i) => v === b[i]);
      }
      return { id: q.id, correct, points: correct ? q.points : 0, max: q.points };
    });
  return { autoScore: results.reduce((s, r) => s + r.points, 0), results };
}
