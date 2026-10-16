import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "@/lib/content/schema";
import { gradeAnswers, instantPoints, instantScore } from "./grading";
import { answerSchema, draftInputSchema, submissionInputSchema } from "./input";
import { isRunComplete, parseInstantRun, solvedTries, tryLabel } from "./instant";
import { restoreDraft } from "./draft";
import { place, placementsOf, POOL } from "./match";
import { answerReveal, questionResults, REVEAL_ALL } from "./results";
import { attemptState, maxAttemptsFor, MAX_ATTEMPTS } from "./rules";

const USER = "11111111-1111-4111-8111-111111111111";

const match = (onePerCategory: boolean): Extract<PublicQuestion, { kind: "match" }> => ({
  id: "m",
  kind: "match",
  prompt: "Match",
  points: 4,
  one_per_category: onePerCategory,
  categories: [{ id: "c1", label: "C1" }, { id: "c2", label: "C2" }],
  items: [{ id: "x", label: "X" }, { id: "y", label: "Y" }],
});
const single: PublicQuestion = { id: "s", kind: "single", prompt: "S", points: 3, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };

describe("instant scoring", () => {
  it("gives full points on the first try, half on the second, nothing after", () => {
    expect([1, 2, 3, 7].map((t) => instantPoints(2, t))).toEqual([2, 1, 0, 0]);
  });

  it("rounds to half points", () => {
    expect(instantPoints(3, 2)).toBe(1.5);
    expect(instantPoints(5, 2)).toBe(2.5);
  });

  it("adds up the solved questions only", () => {
    expect(instantScore([single, match(true)], { s: 2, m: 1 })).toBe(5.5);
    expect(instantScore([single, match(true)], { s: 1 })).toBe(3);
  });
});

describe("the instant run in a draft", () => {
  const raw = { test: false, questions: { s: { tries: 2, solved: true }, m: { tries: 1, solved: false } } };

  it("reads a run of the right kind and ignores one of the other kind", () => {
    expect(parseInstantRun(raw, false)).toEqual(raw.questions);
    expect(parseInstantRun(raw, true)).toEqual({});
  });

  it("never trusts the stored JSON", () => {
    expect(parseInstantRun(null, false)).toEqual({});
    expect(parseInstantRun([], false)).toEqual({});
    expect(parseInstantRun({ test: false, questions: { s: { tries: "2", solved: true }, m: { tries: 0, solved: false }, k: null } }, false)).toEqual({});
  });

  it("is complete only when every question is solved, and keeps the tries behind each", () => {
    const run = parseInstantRun(raw, false);
    expect(isRunComplete([single, match(true)], run)).toBe(false);
    expect(isRunComplete([single], run)).toBe(true);
    expect(solvedTries([single, match(true)], run)).toEqual({ s: 2 });
  });

  it("labels tries", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(tryLabel)).toEqual(["1st try", "2nd try", "3rd try", "4th try", "11th try", "12th try", "13th try", "21st try"]);
  });
});

describe("one real attempt in instant mode", () => {
  const done = [{ attempt: 1, status: "published" as const, final_score: 2, max_score: 6 }];

  it("allows 1 attempt for instant, 3 otherwise", () => {
    expect(maxAttemptsFor("instant")).toBe(1);
    expect(maxAttemptsFor("final")).toBe(MAX_ATTEMPTS);
    expect(maxAttemptsFor(undefined)).toBe(MAX_ATTEMPTS);
  });

  it("closes after the first completed run, even below full points", () => {
    expect(attemptState(done, 1)).toMatchObject({ canSubmit: false, reason: "This quiz has one attempt, and you've completed it." });
    expect(attemptState(done)).toMatchObject({ canSubmit: true });
  });

  it("shows the answers once that attempt is in", () => {
    expect(answerReveal(done, 1)).toEqual(REVEAL_ALL);
    expect(answerReveal(done)).toEqual({ reveal: false, attemptsLeft: 2 });
  });
});

describe("match answers", () => {
  const key = { m: ["x=c1", "y=c2"] };

  it("are graded all-or-nothing, in any order", () => {
    expect(gradeAnswers([match(true)], key, { m: ["y=c2", "x=c1"] }).autoScore).toBe(4);
    expect(gradeAnswers([match(true)], key, { m: ["x=c1", "y=c1"] }).autoScore).toBe(0);
    expect(gradeAnswers([match(true)], key, { m: ["x=c1"] }).autoScore).toBe(0);
    expect(gradeAnswers([match(true)], key, { m: "x=c1" }).autoScore).toBe(0);
  });

  it("need every item placed, known ids, each item once", () => {
    const ok = (v: unknown, q = match(false)) => answerSchema(q).safeParse(v).success;
    expect(ok(["x=c1", "y=c1"])).toBe(true); // several on one category is fine here
    expect(ok(["x=c1"])).toBe(false);
    expect(ok(["x=c1", "x=c2"])).toBe(false);
    expect(ok(["x=c1", "y=c3"])).toBe(false);
    expect(ok(["x=c1", "y=c2", "z=c1"])).toBe(false);
  });

  it("take one item per category when each category holds one", () => {
    expect(answerSchema(match(true)).safeParse(["x=c1", "y=c1"]).success).toBe(false);
    expect(answerSchema(match(true)).safeParse(["x=c2", "y=c1"]).success).toBe(true);
  });

  it("can be partial in a draft, never malformed", () => {
    const challenge = { slug: "c", questions: [match(true)], submission_spec: {} };
    const draft = (m: unknown) => draftInputSchema(challenge, USER, 3).safeParse({ version: 1, step: 1, answers: { m }, imagePaths: [], figmaUrl: "", reflection: "" }).success;
    expect(draft(["x=c1"])).toBe(true);
    expect(draft(["x=c1", "y=c1"])).toBe(false);
    expect(draft(["x=nowhere"])).toBe(false);
    expect(submissionInputSchema(challenge, USER).safeParse({ answers: { m: ["x=c1"] }, imagePaths: [], figmaUrl: null, reflection: null }).success).toBe(false);
  });

  it("restore from a draft keeping only the pairs that still fit", () => {
    const row = { challenge_version: 1, answers: { m: ["x=c1", "y=c1", "z=c2", 4] }, figma_url: null, reflection: null, image_paths: [], current_step: 1, updated_at: "" };
    const { draft } = restoreDraft(row, { slug: "c", version: 2, questions: [match(true)], submission_spec: {} }, USER, 3);
    expect(draft.answers.m).toEqual(["x=c1"]);
  });

  it("reveal the right pairs only when allowed, and explanations for right answers", () => {
    const hidden = { reveal: false, attemptsLeft: 1 } as const;
    const explanations = { m: "Why." };
    expect(questionResults([match(true)], key, { m: ["x=c2", "y=c1"] }, hidden, { explanations })[0]).toMatchObject({
      correct: false,
      correctOptionIds: null,
      explanation: null,
    });
    expect(questionResults([match(true)], key, { m: ["x=c2", "y=c1"] }, REVEAL_ALL, { explanations })[0]).toMatchObject({
      correctOptionIds: ["x=c1", "y=c2"],
      explanation: "Why.",
    });
    expect(questionResults([match(true)], key, { m: ["x=c1", "y=c2"] }, hidden, { explanations })[0]).toMatchObject({ correct: true, explanation: "Why." });
  });

  it("carry the tries and points of an instant attempt", () => {
    expect(questionResults([match(true)], key, { m: ["x=c1", "y=c2"] }, REVEAL_ALL, { questionTries: { m: 2 } })[0].instant).toEqual({
      tries: 2,
      points: 2,
      max: 4,
    });
  });
});

describe("placing match items (the match field)", () => {
  const items = opts2("x", "y", "z");
  const categories = opts2("c1", "c2");

  it("reads only pairs with known items and categories", () => {
    expect([...placementsOf(items, categories, ["x=c1", "q=c1", "y=c9", "z=c2"])]).toEqual([["x", "c1"], ["z", "c2"]]);
  });

  it("sends the item already there back when each category takes one", () => {
    const now = placementsOf(items, categories, ["x=c1"]);
    expect(place(items, now, "y", "c1", true)).toEqual({ pairs: ["y=c1"], displaced: "x" });
    expect(place(items, now, "y", "c1", false)).toEqual({ pairs: ["x=c1", "y=c1"], displaced: null });
  });

  it("puts an item back in the pool", () => {
    expect(place(items, placementsOf(items, categories, ["x=c1", "y=c2"]), "x", POOL, true)).toEqual({ pairs: ["y=c2"], displaced: null });
  });
});

function opts2(...ids: string[]) {
  return ids.map((id) => ({ id, label: id }));
}
