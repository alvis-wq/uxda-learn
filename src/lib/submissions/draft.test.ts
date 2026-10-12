import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "@/lib/content/schema";
import { draftKey, parseDraft, serializeDraft, type Draft } from "./draft";

const questions: PublicQuestion[] = [
  { id: "q1", kind: "single", prompt: "P", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
  { id: "q2", kind: "multi", prompt: "P", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
  { id: "q3", kind: "text", prompt: "P", points: 1 },
];

describe("draft", () => {
  it("is keyed by user, challenge and content version", () => {
    expect(draftKey("u1", "demo", 3)).toBe("uxda:draft:u1:demo:v3");
    expect(draftKey("u1", "demo", 3)).not.toBe(draftKey("u2", "demo", 3));
    expect(draftKey("u1", "demo", 3)).not.toBe(draftKey("u1", "demo", 4));
  });

  it("round-trips a draft", () => {
    const draft: Draft = { answers: { q1: "a", q2: ["a", "b"], q3: "hello" }, figmaUrl: "https://figma.com/x", reflection: "words", step: 3 };
    expect(parseDraft(serializeDraft(draft), questions, 5)).toEqual(draft);
  });

  it("returns null for nothing or junk, never throwing", () => {
    expect(parseDraft(null, questions, 5)).toBeNull();
    expect(parseDraft("", questions, 5)).toBeNull();
    expect(parseDraft("{not json", questions, 5)).toBeNull();
    expect(parseDraft("42", questions, 5)).toBeNull();
    expect(parseDraft("null", questions, 5)).toBeNull();
  });

  it("drops answers that no longer fit the questions", () => {
    const raw = JSON.stringify({ answers: { q1: "zzz", q2: ["a", "zzz", "a"], q3: 7, gone: "x" }, figmaUrl: 5, reflection: null, step: 2 });
    expect(parseDraft(raw, questions, 5)).toEqual({ answers: { q2: ["a"] }, figmaUrl: "", reflection: "", step: 2 });
  });

  it("keeps the step within the available steps", () => {
    expect(parseDraft(JSON.stringify({ step: 99 }), questions, 4)?.step).toBe(4);
    expect(parseDraft(JSON.stringify({ step: -2 }), questions, 4)?.step).toBe(1);
    expect(parseDraft(JSON.stringify({ step: 1.5 }), questions, 4)?.step).toBe(1);
    expect(parseDraft(JSON.stringify({}), questions, 4)?.step).toBe(1);
  });
});
