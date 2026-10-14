import { describe, expect, it } from "vitest";
import { cardCta, cardSpans, listSpans, resolveCardImage, showTryAgain } from "./card";

describe("cardCta", () => {
  it("Start when there is no attempt yet", () => {
    expect(cardCta({ type: "quiz", latestStatus: undefined })).toBe("Start");
    expect(cardCta({ type: "mixed", latestStatus: null })).toBe("Start");
  });
  it("Continue when a resubmission was requested", () => {
    expect(cardCta({ type: "screenshot", latestStatus: "needs_resubmission" })).toBe("Continue");
  });
  it("View result once something is submitted, under review or published", () => {
    for (const latestStatus of ["submitted", "ai_reviewed", "published"] as const) {
      expect(cardCta({ type: "figma", latestStatus })).toBe("View result");
    }
  });
  it("Continue when there is a saved draft, whatever came before", () => {
    expect(cardCta({ type: "mixed", latestStatus: null, inProgress: true })).toBe("Continue");
    expect(cardCta({ type: "quiz", latestStatus: "published", inProgress: true })).toBe("Continue");
    expect(cardCta({ type: "quiz", latestStatus: null, inProgress: false })).toBe("Start");
  });
  it("acknowledge challenges: Start, then View result once acknowledged", () => {
    expect(cardCta({ type: "acknowledge", acknowledged: false, latestStatus: null })).toBe("Start");
    expect(cardCta({ type: "acknowledge", acknowledged: true, latestStatus: null })).toBe("View result");
  });
});

describe("resolveCardImage", () => {
  it("prefers the challenge's image, falls back to the category's, else none", () => {
    expect(resolveCardImage("own.webp", "cat.webp")).toBe("/challenges/own.webp");
    expect(resolveCardImage(null, "cat.webp")).toBe("/challenges/cat.webp");
    expect(resolveCardImage(undefined, "cat.webp")).toBe("/challenges/cat.webp");
    expect(resolveCardImage(null, null)).toBeNull();
    expect(resolveCardImage(undefined, undefined)).toBeNull();
  });
});

describe("cardSpans", () => {
  it("alternates wide/narrow then narrow/wide, row by row", () => {
    expect(cardSpans(4)).toEqual(["wide", "narrow", "narrow", "wide"]);
    expect(cardSpans(6)).toEqual(["wide", "narrow", "narrow", "wide", "wide", "narrow"]);
  });
  it("gives a lone last card the full width", () => {
    expect(cardSpans(1)).toEqual(["full"]);
    expect(cardSpans(3)).toEqual(["wide", "narrow", "full"]);
    expect(cardSpans(5)).toEqual(["wide", "narrow", "narrow", "wide", "full"]);
  });
  it("is empty for no cards", () => {
    expect(cardSpans(0)).toEqual([]);
  });
});

describe("listSpans", () => {
  it("gives chained path cards the full width and restarts the alternation around them", () => {
    expect(listSpans([false, false, true, true, true, false, false, false])).toEqual([
      "wide", "narrow", "full", "full", "full", "wide", "narrow", "full",
    ]);
    expect(listSpans([false, true, false])).toEqual(["full", "full", "full"]);
  });
  it("is cardSpans for a list without chains", () => {
    expect(listSpans([false, false, false, false, false])).toEqual(cardSpans(5));
    expect(listSpans([])).toEqual([]);
  });
});

describe("showTryAgain", () => {
  it("shows next to View result when the learner can attempt again", () => {
    expect(showTryAgain("View result", true)).toBe(true);
  });
  it("hides it without attempts left or with full marks (canRetry false)", () => {
    expect(showTryAgain("View result", false)).toBe(false);
  });
  it("hides it when the card already offers Start or Continue", () => {
    expect(showTryAgain("Start", true)).toBe(false);
    expect(showTryAgain("Continue", true)).toBe(false);
  });
});
