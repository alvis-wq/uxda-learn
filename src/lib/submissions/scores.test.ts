import { describe, expect, it } from "vitest";
import { groupAttemptHistory, isLowScore, rankRows, summarizeScores, type SubmissionStatus } from "./rules";

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

describe("groupAttemptHistory", () => {
  const a = (
    challenge_slug: string,
    attempt: number,
    status: SubmissionStatus,
    final_score: number | null,
    submitted_at: string,
  ) => ({ id: `${challenge_slug}-${attempt}`, challenge_slug, attempt, status, final_score, max_score: 10, submitted_at });

  it("puts the best published attempt first and labels the rest", () => {
    const [g] = groupAttemptHistory([
      a("quiz", 1, "published", 4, "2026-10-01"),
      a("quiz", 2, "published", 9, "2026-10-02"),
      a("quiz", 3, "published", 6, "2026-10-03"),
    ]);
    expect(g.headline).toMatchObject({ attempt: 2, label: "best" });
    expect(g.bestScore).toBe(9);
    expect(g.others.map((o) => [o.attempt, o.label])).toEqual([
      [3, "not_counted"],
      [1, "earlier"],
    ]);
    expect(g.newer).toMatchObject({ attempt: 3 });
    expect(g.attemptsUsed).toBe(3);
  });

  it("counts the first attempt that reached a tied best score", () => {
    const [g] = groupAttemptHistory([a("q", 1, "published", 8, "2026-10-01"), a("q", 2, "published", 8, "2026-10-02")]);
    expect(g.headline.attempt).toBe(1);
    expect(g.others[0].label).toBe("not_counted");
  });

  it("shows the latest attempt when nothing is published yet", () => {
    const [g] = groupAttemptHistory([
      a("shot", 1, "needs_resubmission", 3, "2026-10-01"),
      a("shot", 2, "ai_reviewed", 7, "2026-10-05"),
    ]);
    expect(g.headline).toMatchObject({ attempt: 2, label: "pending" });
    expect(g.bestScore).toBeNull();
    expect(g.newer).toBeNull();
    expect(g.others).toEqual([expect.objectContaining({ attempt: 1, label: "resubmission" })]);
  });

  it("keeps a published best as the headline while a retry awaits review", () => {
    const [g] = groupAttemptHistory([a("shot", 1, "published", 5, "2026-10-01"), a("shot", 2, "submitted", null, "2026-10-04")]);
    expect(g.headline).toMatchObject({ attempt: 1, label: "best" });
    expect(g.newer).toMatchObject({ attempt: 2, label: "pending" });
  });

  it("orders challenges by their most recent attempt", () => {
    const groups = groupAttemptHistory([
      a("old", 1, "published", 5, "2026-09-01"),
      a("new", 1, "published", 5, "2026-10-01"),
      a("old", 2, "published", 6, "2026-10-02"),
    ]);
    expect(groups.map((g) => g.slug)).toEqual(["old", "new"]);
  });
});

describe("isLowScore", () => {
  it("flags scores below half the points", () => {
    expect(isLowScore(4.5, 10)).toBe(true);
    expect(isLowScore(5, 10)).toBe(false);
    expect(isLowScore(0, 10)).toBe(true);
    expect(isLowScore(null, 10)).toBe(false);
    expect(isLowScore(0, 0)).toBe(false);
  });
});
