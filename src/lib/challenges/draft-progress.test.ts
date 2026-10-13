import { describe, expect, it } from "vitest";
import { draftProgress } from "./draft-progress";

const single = (id: string) => ({ id, kind: "single", prompt: "P", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
const text = { id: "t", kind: "text", prompt: "P", points: 1 };

describe("draftProgress", () => {
  it("a quiz has one step per question plus Review", () => {
    expect(draftProgress({ questions: [single("a"), single("b"), single("c")], submission_spec: {} }, 2)).toEqual({ step: 2, total: 4 });
  });

  it("a mixed challenge counts Brief, each input step and Review", () => {
    const spec = { screenshots: { min: 1, max: 2, label: "S" }, figma_url: { required: true, label: "F" }, reflection: { required: false, prompt: "R" } };
    // Brief, Screenshots, Figma, Reflection, Review
    expect(draftProgress({ questions: [], submission_spec: spec }, 3)).toEqual({ step: 3, total: 5 });
    // + Questions
    expect(draftProgress({ questions: [text], submission_spec: spec }, 1)).toEqual({ step: 1, total: 6 });
  });

  it("is null without a Stepper (single-step challenges)", () => {
    expect(draftProgress({ questions: [single("a")], submission_spec: {} }, 1)).toBeNull();
    expect(draftProgress({ questions: [], submission_spec: { figma_url: { required: true, label: "F" } } }, 1)).toBeNull();
    expect(draftProgress({ questions: [text], submission_spec: {} }, 1)).toBeNull();
  });

  it("holds a step beyond the current plan at the last one, and a bad step at the first", () => {
    const q = [single("a"), single("b")];
    expect(draftProgress({ questions: q, submission_spec: {} }, 9)).toEqual({ step: 3, total: 3 });
    expect(draftProgress({ questions: q, submission_spec: {} }, 0)).toEqual({ step: 1, total: 3 });
    expect(draftProgress({ questions: q, submission_spec: {} }, 1.5)).toEqual({ step: 1, total: 3 });
  });

  it("is null rather than throwing on malformed content", () => {
    expect(draftProgress({ questions: "nope", submission_spec: {} }, 1)).toBeNull();
    expect(draftProgress({ questions: [], submission_spec: { screenshots: 5 } }, 1)).toBeNull();
  });
});
