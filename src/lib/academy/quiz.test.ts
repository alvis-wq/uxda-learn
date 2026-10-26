import { describe, expect, it } from "vitest";
import { gradeQuiz, joinQuiz, PASS_MARK, quizDraftSchema, splitQuiz, type QuizDraft } from "./quiz";

const draft: QuizDraft = Array.from({ length: 5 }, (_, i) => ({
  prompt: `Question ${i + 1}?`,
  options: [`right ${i}`, `wrong ${i}a`, `wrong ${i}b`, `wrong ${i}c`],
  answer: 0,
}));

/** A seeded generator, so the shuffle is repeatable. */
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe("quizDraftSchema", () => {
  it("takes exactly 5 questions of 4 distinct options with an answer index", () => {
    expect(quizDraftSchema.safeParse(draft).success).toBe(true);
    expect(quizDraftSchema.safeParse(draft.slice(0, 4)).success).toBe(false);
    expect(quizDraftSchema.safeParse([...draft.slice(0, 4), { ...draft[4], options: ["a", "b", "c"] }]).success).toBe(false);
    expect(quizDraftSchema.safeParse([...draft.slice(0, 4), { ...draft[4], answer: 4 }]).success).toBe(false);
    expect(quizDraftSchema.safeParse([...draft.slice(0, 4), { ...draft[4], options: ["a", "A", "c", "d"] }]).success).toBe(false);
    expect(quizDraftSchema.safeParse([...draft.slice(0, 4), { ...draft[4], prompt: "  " }]).success).toBe(false);
  });
});

describe("splitQuiz / joinQuiz", () => {
  it("stores public questions without answers, and the key apart", () => {
    const { questions, answerKey } = splitQuiz(draft, seeded(7));
    expect(questions.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(JSON.stringify(questions)).not.toContain("answer");
    for (const q of questions) {
      expect(q.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
      expect(q.options.find((o) => o.id === answerKey[q.id])?.label).toMatch(/^right/);
    }
  });

  it("shuffles options, so the right one isn't always first", () => {
    const { answerKey } = splitQuiz(draft, seeded(3));
    expect(new Set(Object.values(answerKey)).size).toBeGreaterThan(1);
  });

  it("joins back to an equivalent draft for editing", () => {
    const { questions, answerKey } = splitQuiz(draft, seeded(11));
    const back = joinQuiz(questions, answerKey)!;
    back.forEach((q, i) => {
      expect(q.prompt).toBe(draft[i].prompt);
      expect(q.options[q.answer]).toBe(`right ${i}`);
      expect([...q.options].sort()).toEqual([...draft[i].options].sort());
    });
  });

  it("returns null when there's no quiz or the halves don't fit", () => {
    expect(joinQuiz([], {})).toBeNull();
    const { questions } = splitQuiz(draft);
    expect(joinQuiz(questions, {})).toBeNull();
  });
});

describe("gradeQuiz", () => {
  const { questions, answerKey } = splitQuiz(draft, seeded(5));
  const right = Object.fromEntries(questions.map((q) => [q.id, answerKey[q.id]]));
  const wrongFor = (id: string) => questions.find((q) => q.id === id)!.options.find((o) => o.id !== answerKey[id])!.id;

  it(`passes at ${PASS_MARK} of 5 and lists the wrong question ids`, () => {
    expect(gradeQuiz(questions, answerKey, right)).toEqual({ correct: 5, total: 5, passed: true, wrong: [] });
    expect(gradeQuiz(questions, answerKey, { ...right, q2: wrongFor("q2") })).toEqual({ correct: 4, total: 5, passed: true, wrong: ["q2"] });
    expect(gradeQuiz(questions, answerKey, { ...right, q2: wrongFor("q2"), q5: wrongFor("q5") })).toEqual({
      correct: 3,
      total: 5,
      passed: false,
      wrong: ["q2", "q5"],
    });
  });

  it("counts unanswered questions as wrong", () => {
    const rest = Object.fromEntries(Object.entries(right).filter(([id]) => id !== "q1"));
    expect(gradeQuiz(questions, answerKey, rest)).toMatchObject({ correct: 4, wrong: ["q1"] });
    expect(gradeQuiz(questions, answerKey, {})).toMatchObject({ correct: 0, passed: false });
  });
});
