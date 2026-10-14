import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "@/lib/content/schema";
import { answerReveal, questionResults, REVEAL_ALL, tryAgainMessage } from "./results";

const opts = (...ids: string[]) => ids.map((id) => ({ id, label: `Option ${id}` }));
const questions: PublicQuestion[] = [
  { id: "q1", kind: "single", prompt: "One?", points: 2, options: opts("a", "b", "c") },
  { id: "q2", kind: "multi", prompt: "Many?", points: 3, options: opts("a", "b", "c") },
  { id: "q3", kind: "text", prompt: "Say?", points: 0 } as PublicQuestion,
];
const key = { q1: "b", q2: ["a", "c"] };

const attempt = (status: "published" | "needs_resubmission" | "submitted", final: number | null, max = 5) => ({
  status,
  final_score: final,
  max_score: max,
});

describe("answerReveal", () => {
  it("hides the key after a first imperfect attempt and counts the attempts left", () => {
    expect(answerReveal([attempt("published", 2)])).toEqual({ reveal: false, attemptsLeft: 2 });
    expect(answerReveal([attempt("published", 2), attempt("published", 3)])).toEqual({ reveal: false, attemptsLeft: 1 });
  });

  it("reveals with full marks on a published attempt", () => {
    expect(answerReveal([attempt("published", 2), attempt("published", 5)])).toEqual(REVEAL_ALL);
  });

  it("reveals once all three attempts are used, whatever the scores", () => {
    expect(answerReveal([attempt("published", 0), attempt("published", 1), attempt("published", 2)])).toEqual(REVEAL_ALL);
    expect(answerReveal([attempt("needs_resubmission", null), attempt("submitted", null), attempt("published", 1)])).toEqual(REVEAL_ALL);
  });

  it("does not treat a score that is not published as full marks", () => {
    expect(answerReveal([attempt("submitted", 5)]).reveal).toBe(false);
    expect(answerReveal([attempt("needs_resubmission", 5)]).reveal).toBe(false);
  });

  it("does not treat a 0-point challenge as full marks", () => {
    expect(answerReveal([attempt("published", 0, 0)]).reveal).toBe(false);
  });

  it("is hidden with no attempts at all", () => {
    expect(answerReveal([])).toEqual({ reveal: false, attemptsLeft: 3 });
  });
});

describe("tryAgainMessage", () => {
  it("pluralises the attempts left", () => {
    expect(tryAgainMessage(2)).toBe("Try again to find the right answer — 2 attempts left.");
    expect(tryAgainMessage(1)).toBe("Try again to find the right answer — 1 attempt left.");
  });
});

describe("questionResults", () => {
  const hidden = { reveal: false, attemptsLeft: 2 } as const;

  it("marks single and multi questions, skips text, keeps question order", () => {
    const r = questionResults(questions, key, { q1: "b", q2: ["a"], q3: "hi" }, hidden);
    expect(r.map((x) => [x.questionId, x.correct])).toEqual([
      ["q1", true],
      ["q2", false],
    ]);
  });

  it("multi is an exact set match, regardless of order", () => {
    expect(questionResults(questions, key, { q1: "b", q2: ["c", "a"] }, hidden)[1].correct).toBe(true);
    expect(questionResults(questions, key, { q1: "b", q2: ["a", "b", "c"] }, hidden)[1].correct).toBe(false);
  });

  it("never carries the right answer while the reveal is closed", () => {
    const r = questionResults(questions, key, { q1: "a", q2: [] }, hidden);
    expect(r.every((x) => !x.correct)).toBe(true);
    expect(JSON.stringify(r)).not.toContain('"b"'); // q1's key
    expect(r.every((x) => x.correctOptionIds === null)).toBe(true);
  });

  it("carries the right answer for wrong questions only once revealed", () => {
    const r = questionResults(questions, key, { q1: "a", q2: ["a", "c"] }, REVEAL_ALL);
    expect(r[0]).toEqual({ questionId: "q1", correct: false, correctOptionIds: ["b"] });
    expect(r[1]).toEqual({ questionId: "q2", correct: true, correctOptionIds: null });
  });

  it("treats a missing or malformed answer as wrong", () => {
    const r = questionResults(questions, key, { q1: 7, q2: [1, 2] }, REVEAL_ALL);
    expect(r.map((x) => x.correct)).toEqual([false, false]);
    expect(r[1].correctOptionIds).toEqual(["a", "c"]);
    expect(questionResults(questions, key, {}, REVEAL_ALL).every((x) => !x.correct)).toBe(true);
  });

  it("has nothing to reveal for a question with no key", () => {
    const r = questionResults(questions, {}, { q1: "a", q2: ["a"] }, REVEAL_ALL);
    expect(r.every((x) => !x.correct && x.correctOptionIds === null)).toBe(true);
  });
});
