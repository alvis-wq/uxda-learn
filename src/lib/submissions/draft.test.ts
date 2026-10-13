import { describe, expect, it } from "vitest";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { isBlankDraft, restoreDraft, type Draft, type DraftRow } from "./draft";
import { draftInputSchema, submissionInputSchema } from "./input";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const IMG = (user: string, slug = "demo", n = 1) => `${user}/${slug}/aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}.png`;

const questions: PublicQuestion[] = [
  { id: "q1", kind: "single", prompt: "P", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
  { id: "q2", kind: "multi", prompt: "P", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
  { id: "q3", kind: "text", prompt: "P", points: 1, min_words: 3 },
];
const spec: SubmissionSpec = {
  screenshots: { min: 1, max: 2, label: "Shots" },
  figma_url: { required: true, label: "Link" },
  reflection: { required: true, prompt: "Why", min_words: 5 },
};
const challenge = { slug: "demo", version: 2, questions, submission_spec: spec };

const row = (over: Partial<DraftRow> = {}): DraftRow => ({
  challenge_version: 2,
  answers: { q1: "a", q2: ["a", "b"], q3: "hello there you" },
  figma_url: "https://figma.com/design/x",
  reflection: "some words",
  image_paths: [IMG(USER)],
  current_step: 3,
  updated_at: "2026-10-13T10:00:00Z",
  ...over,
});

describe("restoreDraft", () => {
  it("round-trips a draft saved against the current version, without a reset notice", () => {
    expect(restoreDraft(row(), challenge, USER, 5)).toEqual({
      draft: {
        answers: { q1: "a", q2: ["a", "b"], q3: "hello there you" },
        figmaUrl: "https://figma.com/design/x",
        reflection: "some words",
        imagePaths: [IMG(USER)],
        step: 3,
      },
      reset: false,
    });
  });

  it("keeps the answers whose question ids still exist and says the rest were reset when the version changed", () => {
    const old = row({ challenge_version: 1, answers: { q1: "a", gone: "x", q3: "kept text" } });
    const { draft, reset } = restoreDraft(old, challenge, USER, 5);
    expect(draft.answers).toEqual({ q1: "a", q3: "kept text" });
    expect(reset).toBe(true);
  });

  it("drops a choice that is no longer an option (version changed)", () => {
    const old = row({ challenge_version: 1, answers: { q1: "removed", q2: ["a", "removed"] } });
    const { draft, reset } = restoreDraft(old, challenge, USER, 5);
    expect(draft.answers).toEqual({ q2: ["a"] });
    expect(reset).toBe(true);
  });

  it("says nothing when the version changed but every answer still fits", () => {
    const { reset } = restoreDraft(row({ challenge_version: 1 }), challenge, USER, 5);
    expect(reset).toBe(false);
  });

  it("drops a Figma link, reflection and screenshots the challenge no longer asks for", () => {
    const noSpec = { ...challenge, submission_spec: {} };
    const { draft, reset } = restoreDraft(row({ challenge_version: 1 }), noSpec, USER, 5);
    expect(draft).toMatchObject({ figmaUrl: "", reflection: "", imagePaths: [] });
    expect(reset).toBe(true);
  });

  it("never restores someone else's screenshot, a foreign challenge's, duplicates, or more than the maximum", () => {
    const { draft } = restoreDraft(
      row({ image_paths: [IMG(OTHER), IMG(USER, "other-challenge"), IMG(USER, "demo", 1), IMG(USER, "demo", 1), IMG(USER, "demo", 2), IMG(USER, "demo", 3), "../x.png"] }),
      challenge,
      USER,
      5,
    );
    expect(draft.imagePaths).toEqual([IMG(USER, "demo", 1), IMG(USER, "demo", 2)]);
  });

  it("keeps the step within the steps there are now", () => {
    expect(restoreDraft(row({ current_step: 99 }), challenge, USER, 4).draft.step).toBe(4);
    expect(restoreDraft(row({ current_step: -2 }), challenge, USER, 4).draft.step).toBe(1);
    expect(restoreDraft(row({ current_step: 1.5 }), challenge, USER, 4).draft.step).toBe(1);
  });

  it("copes with junk answers and nulls without throwing", () => {
    for (const answers of [null, [], "x", 5, { q1: 7, q2: "a", q3: { a: 1 } }]) {
      const { draft } = restoreDraft(row({ answers, figma_url: null, reflection: null }), challenge, USER, 5);
      expect(draft.answers).toEqual({});
      expect(draft.figmaUrl).toBe("");
    }
  });
});

describe("isBlankDraft", () => {
  const blank: Draft = { answers: {}, figmaUrl: "", reflection: "", imagePaths: [], step: 1 };
  it("is blank only with nothing entered on the first step", () => {
    expect(isBlankDraft(blank)).toBe(true);
    expect(isBlankDraft({ ...blank, answers: { q3: "" }, })).toBe(true);
    expect(isBlankDraft({ ...blank, answers: { q2: [] } })).toBe(true);
    expect(isBlankDraft({ ...blank, step: 2 })).toBe(false);
    expect(isBlankDraft({ ...blank, answers: { q1: "a" } })).toBe(false);
    expect(isBlankDraft({ ...blank, figmaUrl: "h" })).toBe(false);
    expect(isBlankDraft({ ...blank, reflection: "h" })).toBe(false);
    expect(isBlankDraft({ ...blank, imagePaths: [IMG(USER)] })).toBe(false);
  });
});

describe("draftInputSchema", () => {
  const schema = draftInputSchema(challenge, USER, 5);
  const valid = { version: 2, step: 2, answers: {}, imagePaths: [], figmaUrl: "", reflection: "" };

  it("accepts an unfinished form: no answers, a short text answer, a half-typed link, no screenshots", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, answers: { q3: "hi" }, figmaUrl: "https://fig", reflection: "x" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, answers: { q2: [] } }).success).toBe(true);
  });

  it("accepts anything a complete submission would accept", () => {
    const submission = {
      answers: { q1: "a", q2: ["a"], q3: "one two three" },
      imagePaths: [IMG(USER)],
      figmaUrl: "https://www.figma.com/design/abc",
      reflection: "one two three four five six",
    };
    expect(submissionInputSchema(challenge, USER).safeParse(submission).success).toBe(true);
    expect(schema.safeParse({ ...submission, version: 2, step: 5 }).success).toBe(true);
  });

  it.each([
    ["an unknown question", { answers: { nope: "a" } }],
    ["an unknown option", { answers: { q1: "zzz" } }],
    ["a repeated option", { answers: { q2: ["a", "a"] } }],
    ["a non-string text answer", { answers: { q3: 5 } }],
    ["a huge text answer", { answers: { q3: "x".repeat(20_001) } }],
    ["someone else's screenshot", { imagePaths: [IMG(OTHER)] }],
    ["too many screenshots", { imagePaths: [IMG(USER, "demo", 1), IMG(USER, "demo", 2), IMG(USER, "demo", 3)] }],
    ["a step beyond the last", { step: 6 }],
    ["step 0", { step: 0 }],
    ["a missing version", { version: undefined }],
  ])("rejects %s", (_label, over) => {
    expect(schema.safeParse({ ...valid, ...over }).success).toBe(false);
  });

  it("rejects fields the challenge doesn't have", () => {
    const bare = draftInputSchema({ slug: "demo", questions, submission_spec: {} }, USER, 5);
    expect(bare.safeParse({ ...valid, figmaUrl: "https://figma.com/x" }).success).toBe(false);
    expect(bare.safeParse({ ...valid, reflection: "x" }).success).toBe(false);
    expect(bare.safeParse({ ...valid, imagePaths: [IMG(USER)] }).success).toBe(false);
    expect(bare.safeParse(valid).success).toBe(true);
  });
});
