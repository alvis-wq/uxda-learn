import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "@/lib/content/schema";
import { gradeAnswers } from "./grading";
import { draftInputSchema, submissionInputSchema } from "./input";
import { restoreDraft } from "./draft";
import { answerReveal, questionResults, REVEAL_ALL } from "./results";

const USER = "11111111-1111-4111-8111-111111111111";
const items = ["b", "c", "a", "d"].map((id) => ({ id, label: id.toUpperCase() })); // as stored: shuffled
const questions: PublicQuestion[] = [{ id: "q1", kind: "order", prompt: "Order", items, points: 4 }];
const key = { q1: ["a", "b", "c", "d"] };
const challenge = { slug: "c1", questions, submission_spec: {} };

describe("order grading", () => {
  it("is all-or-nothing on the exact sequence", () => {
    expect(gradeAnswers(questions, key, { q1: ["a", "b", "c", "d"] }).autoScore).toBe(4);
    expect(gradeAnswers(questions, key, { q1: ["a", "b", "d", "c"] }).autoScore).toBe(0); // one swap is wrong
    expect(gradeAnswers(questions, key, { q1: ["d", "c", "b", "a"] }).autoScore).toBe(0);
  });

  it("a missing, short or non-list answer scores 0", () => {
    expect(gradeAnswers(questions, key, {}).autoScore).toBe(0);
    expect(gradeAnswers(questions, key, { q1: ["a", "b"] }).autoScore).toBe(0);
    expect(gradeAnswers(questions, key, { q1: "a" }).autoScore).toBe(0);
  });
});

describe("order submission input", () => {
  const schema = submissionInputSchema(challenge, USER);
  const base = { imagePaths: [], figmaUrl: null, reflection: null };

  it("accepts a full arrangement of the items, in any order", () => {
    expect(schema.safeParse({ ...base, answers: { q1: ["d", "c", "b", "a"] } }).success).toBe(true);
  });

  it("rejects a missing, short, repeated or unknown arrangement", () => {
    for (const q1 of [undefined, ["a", "b"], ["a", "a", "b", "c"], ["a", "b", "c", "z"], "a"]) {
      expect(schema.safeParse({ ...base, answers: { q1 } }).success, JSON.stringify(q1)).toBe(false);
    }
  });

  it("tells the learner to put the items in order", () => {
    const r = schema.safeParse({ ...base, answers: {} });
    expect(r.success ? "" : r.error.issues[0].message).toBe("Put the items in order.");
  });
});

describe("order drafts", () => {
  it("a draft may hold an arrangement of known items, and nothing else", () => {
    const schema = draftInputSchema(challenge, USER, 1);
    const draft = { version: 1, step: 1, imagePaths: [], figmaUrl: "", reflection: "" };
    expect(schema.safeParse({ ...draft, answers: { q1: ["a", "b", "c", "d"] } }).success).toBe(true);
    expect(schema.safeParse({ ...draft, answers: { q1: ["a", "x"] } }).success).toBe(false);
    expect(schema.safeParse({ ...draft, answers: {} }).success).toBe(true);
  });

  const row = (answers: unknown) => ({
    user_id: USER, challenge_slug: "c1", challenge_version: 1, answers, image_paths: [], figma_url: "", reflection: "",
    current_step: 1, updated_at: "", created_at: "", version: 1,
  });
  it("restores a complete arrangement and drops a partial or stale one", () => {
    const full = restoreDraft(row({ q1: ["d", "c", "b", "a"] }) as never, { ...challenge, version: 1 } as never, USER, 1);
    expect(full.draft.answers.q1).toEqual(["d", "c", "b", "a"]);
    const partial = restoreDraft(row({ q1: ["a", "b"] }) as never, { ...challenge, version: 1 } as never, USER, 1);
    expect(partial.draft.answers.q1).toBeUndefined();
    const stale = restoreDraft(row({ q1: ["a", "b", "c", "gone"] }) as never, { ...challenge, version: 1 } as never, USER, 1);
    expect(stale.draft.answers.q1).toBeUndefined();
  });
});

describe("order results", () => {
  const hidden = { reveal: false, attemptsLeft: 2 } as const;

  it("marks the order and only carries the right sequence once revealed", () => {
    const wrong = { q1: ["b", "a", "c", "d"] };
    expect(questionResults(questions, key, wrong, hidden)).toEqual([{ questionId: "q1", correct: false, correctOptionIds: null }]);
    expect(questionResults(questions, key, wrong, REVEAL_ALL)).toEqual([
      { questionId: "q1", correct: false, correctOptionIds: ["a", "b", "c", "d"] }, // in order: not sorted
    ]);
    expect(questionResults(questions, key, { q1: ["a", "b", "c", "d"] }, REVEAL_ALL)[0]).toMatchObject({ correct: true, correctOptionIds: null });
  });

  it("uses the same reveal rules as the other questions", () => {
    expect(answerReveal([{ status: "published", final_score: 0, max_score: 4 }])).toEqual({ reveal: false, attemptsLeft: 2 });
  });
});
