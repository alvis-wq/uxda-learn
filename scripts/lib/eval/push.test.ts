import { describe, expect, it } from "vitest";
import { editedAfter } from "./push";

describe("editedAfter", () => {
  const pulledAt = "2026-10-29T07:36:38.000Z";

  it("is false for a submission the learner never edited", () => {
    expect(editedAfter(null, pulledAt)).toBe(false);
  });

  it("is false for an edit before the pull (the batch holds the new version)", () => {
    expect(editedAfter("2026-10-29T07:30:00.123456+00:00", pulledAt)).toBe(false);
  });

  it("is true for an edit after the pull (the AI scored content that's gone)", () => {
    expect(editedAfter("2026-10-29T08:00:00.5+00:00", pulledAt)).toBe(true);
  });
});
