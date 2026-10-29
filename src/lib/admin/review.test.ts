import { describe, expect, it } from "vitest";
import { adjustReviewSchema, bulkApproveSchema, reviewSchema, sortQueue } from "./review";

const ID = "11111111-1111-4111-8111-111111111111";

describe("reviewSchema", () => {
  it("accepts an approval with a half-point score and no feedback", () => {
    expect(reviewSchema.safeParse({ submissionId: ID, decision: "approve", finalScore: "7.5", feedback: "" }).success).toBe(true);
  });
  it("requires feedback when asking for resubmission", () => {
    expect(reviewSchema.safeParse({ submissionId: ID, decision: "resubmit", finalScore: 0, feedback: " " }).success).toBe(false);
  });
  it("rejects negative or odd fractional scores and bad ids", () => {
    expect(reviewSchema.safeParse({ submissionId: ID, decision: "approve", finalScore: -1, feedback: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ submissionId: ID, decision: "approve", finalScore: 7.3, feedback: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ submissionId: "x", decision: "approve", finalScore: 1, feedback: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ submissionId: ID, decision: "publish", finalScore: 1, feedback: "" }).success).toBe(false);
  });
});

describe("sortQueue", () => {
  it("puts ai_reviewed first, low confidence first, then oldest", () => {
    const items = [
      { id: 1, status: "submitted", submitted_at: "2026-01-01", confidence: null },
      { id: 2, status: "ai_reviewed", submitted_at: "2026-01-03", confidence: "high" },
      { id: 3, status: "ai_reviewed", submitted_at: "2026-01-04", confidence: "low" },
      { id: 4, status: "ai_reviewed", submitted_at: "2026-01-02", confidence: "high" },
    ];
    expect(sortQueue(items).map((i) => i.id)).toEqual([3, 4, 2, 1]);
  });
});

describe("bulkApproveSchema", () => {
  it("takes a list of ids, at least one and at most 200", () => {
    expect(bulkApproveSchema.safeParse([ID]).success).toBe(true);
    expect(bulkApproveSchema.safeParse([]).success).toBe(false);
    expect(bulkApproveSchema.safeParse(["x"]).success).toBe(false);
    expect(bulkApproveSchema.safeParse(Array(201).fill(ID)).success).toBe(false);
  });
});

describe("adjustReviewSchema", () => {
  it("takes whole or half points and optional feedback", () => {
    expect(adjustReviewSchema.safeParse({ submissionId: ID, finalScore: "4.5", feedback: "" }).success).toBe(true);
    expect(adjustReviewSchema.safeParse({ submissionId: ID, finalScore: 4.2, feedback: "" }).success).toBe(false);
    expect(adjustReviewSchema.safeParse({ submissionId: ID, finalScore: -1, feedback: "" }).success).toBe(false);
  });
});
