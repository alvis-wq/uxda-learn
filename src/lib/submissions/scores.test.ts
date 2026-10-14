import { describe, expect, it } from "vitest";
import { groupAttemptHistory, isLowScore, rankOf, rankRows, splitLeaderboard, summarizeScores, type SubmissionStatus } from "./rules";

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

describe("rankOf", () => {
  const rows = [
    { user_id: "a", total_score: 30 },
    { user_id: "b", total_score: 20 },
    { user_id: "c", total_score: 20 },
    { user_id: "d", total_score: 0 },
  ];
  it("is the competition rank and the number ranked (people with points only)", () => {
    expect(rankOf(rows, "a")).toEqual({ position: 1, of: 3 });
    expect(rankOf(rows, "b")).toEqual({ position: 2, of: 3 });
    expect(rankOf(rows, "c")).toEqual({ position: 2, of: 3 }); // tie
  });
  it("is null for someone with no points: they have no rank", () => {
    expect(rankOf(rows, "d")).toBeNull();
    expect(rankOf([{ user_id: "x", total_score: 0 }], "x")).toBeNull();
  });
  it("is null when the user isn't on the board (hidden, or another group)", () => {
    expect(rankOf(rows, "zzz")).toBeNull();
    expect(rankOf([], "a")).toBeNull();
  });
});

describe("splitLeaderboard", () => {
  const row = (user_id: string, total_score: number, full_name: string | null = user_id) => ({ user_id, total_score, full_name });

  it("ranks everyone with points and keeps the order they came in", () => {
    const { ranked } = splitLeaderboard([row("a", 30), row("b", 20), row("c", 20), row("d", 5)]);
    expect(ranked.map((r) => [r.user_id, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 2], ["d", 4]]);
  });

  it("gives people with 0 points no rank and lists them separately, by name", () => {
    const { ranked, notStarted } = splitLeaderboard([row("a", 10), row("z", 0, "Zane"), row("m", 0, "Anna"), row("b", 5), row("n", 0, null)]);
    expect(ranked.map((r) => r.user_id)).toEqual(["a", "b"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
    expect(notStarted.map((r) => r.user_id)).toEqual(["m", "n", "z"]); // Anna, Unnamed, Zane
    expect(notStarted.every((r) => !("rank" in r))).toBe(true);
  });

  it("a board where nobody has points has only the 'not started' group", () => {
    const { ranked, notStarted } = splitLeaderboard([row("a", 0), row("b", 0)]);
    expect(ranked).toEqual([]);
    expect(notStarted).toHaveLength(2);
  });

  it("scores arrive as numbers or numeric strings", () => {
    const { ranked, notStarted } = splitLeaderboard([{ user_id: "a", total_score: "12" as unknown as number }, { user_id: "b", total_score: "0" as unknown as number }]);
    expect(ranked).toHaveLength(1);
    expect(notStarted).toHaveLength(1);
  });
});

