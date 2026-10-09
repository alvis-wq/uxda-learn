import { describe, expect, it } from "vitest";
import { rankRows, summarizeScores } from "./rules";

describe("summarizeScores", () => {
  it("counts the best published attempt per challenge, and pending reviews", () => {
    expect(
      summarizeScores([
        { challenge_slug: "a", status: "published", final_score: 6 },
        { challenge_slug: "a", status: "published", final_score: 9 },
        { challenge_slug: "a", status: "needs_resubmission", final_score: 10 },
        { challenge_slug: "b", status: "published", final_score: 4 },
        { challenge_slug: "c", status: "submitted", final_score: null },
        { challenge_slug: "d", status: "ai_reviewed", final_score: 8 },
      ]),
    ).toEqual({ totalScore: 13, completed: 2, pending: 2 });
  });

  it("is zero for no submissions", () => {
    expect(summarizeScores([])).toEqual({ totalScore: 0, completed: 0, pending: 0 });
  });
});

describe("rankRows", () => {
  it("gives ties the same rank and skips after them", () => {
    const ranked = rankRows([{ total_score: 30 }, { total_score: 20 }, { total_score: 20 }, { total_score: 5 }]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });
});
