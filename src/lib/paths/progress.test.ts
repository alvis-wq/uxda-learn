import { describe, expect, it } from "vitest";
import type { AttemptSummary } from "@/lib/submissions/rules";
import {
  blockingPath,
  lockAll,
  lockReason,
  milestonePlace,
  milestoneStates,
  pathCta,
  pathProgressLine,
  summarizePath,
  type MilestoneInput,
} from "./progress";

const attempt = (n: number, status: AttemptSummary["status"], final_score: number | null = null, max_score = 20): AttemptSummary => ({
  attempt: n,
  status,
  final_score,
  max_score,
});

const m = (slug: string, attempts: AttemptSummary[] = [], over: Partial<MilestoneInput> = {}): MilestoneInput => ({
  slug,
  title: slug.toUpperCase(),
  points: 20,
  attempts,
  testing: false,
  hasDraft: false,
  ...over,
});

describe("milestoneStates", () => {
  it("unlocks only the first milestone when nothing is done", () => {
    const states = milestoneStates(true, [m("a"), m("b"), m("c")]);
    expect(states.map((s) => s.status)).toEqual(["not_started", "locked", "locked"]);
    expect(states.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("unlocks the next one as soon as the previous has any attempt, reviewed or not", () => {
    for (const status of ["submitted", "ai_reviewed", "needs_resubmission", "published"] as const) {
      const states = milestoneStates(true, [m("a", [attempt(1, status, status === "published" ? 20 : null)]), m("b"), m("c")]);
      expect(states[1].unlocked, status).toBe(true);
      expect(states[2].unlocked, status).toBe(false);
    }
  });

  it("does not unlock on a saved draft alone", () => {
    expect(milestoneStates(true, [m("a", [], { hasDraft: true }), m("b")])[1].status).toBe("locked");
  });

  it("never locks a milestone the learner already has an attempt on (imported progress can skip ahead)", () => {
    const states = milestoneStates(true, [m("a"), m("b"), m("c", [attempt(1, "published", 20)])]);
    expect(states.map((s) => s.status)).toEqual(["not_started", "locked", "done"]);
  });

  it("locks nothing in a non-sequential path", () => {
    expect(milestoneStates(false, [m("a"), m("b"), m("c")]).every((s) => s.unlocked)).toBe(true);
  });

  it("labels each status from the attempts", () => {
    const states = milestoneStates(false, [
      m("done", [attempt(1, "published", 15)]),
      m("pending", [attempt(1, "submitted")]),
      m("ai", [attempt(1, "ai_reviewed")]),
      m("changes", [attempt(1, "needs_resubmission", 8)]),
      m("draft", [], { hasDraft: true }),
      m("idle"),
    ]);
    expect(states.map((s) => s.status)).toEqual([
      "done",
      "awaiting_review",
      "awaiting_review",
      "changes_requested",
      "in_progress",
      "not_started",
    ]);
    expect(states[0].bestScore).toBe(15);
    expect(states[3].bestScore).toBeNull(); // changes requested doesn't count
  });

  it("shows a retry awaiting review over an earlier result, but keeps it done with its best score", () => {
    const [s] = milestoneStates(true, [m("a", [attempt(1, "published", 36, 40), attempt(2, "submitted")], { points: 40 })]);
    expect(s).toMatchObject({ status: "awaiting_review", done: true, bestScore: 36 });
  });

  it("an imported 36/40 is done, with its score", () => {
    const [s] = milestoneStates(true, [m("boss", [attempt(1, "published", 36, 40)], { points: 40 })]);
    expect(s).toMatchObject({ status: "done", done: true, bestScore: 36 });
  });

  it("a tester's test attempt marks the milestone done, without a score", () => {
    const states = milestoneStates(true, [m("a", [attempt(1, "published", 0)], { testing: true }), m("b", [], { testing: true })]);
    expect(states[0]).toMatchObject({ status: "done", bestScore: null });
    expect(states[1].unlocked).toBe(true);
  });
});

describe("summarizePath", () => {
  const states = milestoneStates(true, [
    m("a", [attempt(1, "published", 20)]),
    m("b", [attempt(1, "published", 20)]),
    m("c", [attempt(1, "submitted")]),
    m("d", [], { points: 40 }),
  ]);
  const summary = summarizePath(states);

  it("counts done milestones and sums their points", () => {
    expect(summary).toEqual({ done: 2, total: 4, pointsEarned: 40, pointsPossible: 100, started: true, complete: false });
    expect(pathProgressLine(summary)).toBe("2 of 4 · 40/100 pts");
  });

  it("picks the CTA", () => {
    expect(pathCta({ started: false, complete: false })).toBe("Start");
    expect(pathCta(summary)).toBe("Continue");
    expect(pathCta({ started: true, complete: true })).toBe("View");
  });

  it("is complete only when every milestone is done", () => {
    const all = summarizePath(milestoneStates(true, [m("a", [attempt(1, "published", 1)]), m("b", [attempt(1, "published", 20)])]));
    expect(all.complete).toBe(true);
    expect(summarizePath([]).complete).toBe(false);
  });
});

describe("milestonePlace", () => {
  const states = milestoneStates(true, [m("a", [attempt(1, "submitted")]), m("b"), m("c")]);
  const path = { slug: "p", title: "Path" };

  it("says where a milestone sits, what comes next and whether it is locked", () => {
    expect(milestonePlace(path, states, "b")).toEqual({
      pathSlug: "p",
      pathTitle: "Path",
      position: 2,
      total: 3,
      locked: false,
      lockedBy: null,
      next: { slug: "c", title: "C" },
    });
    expect(milestonePlace(path, states, "c")).toMatchObject({ locked: true, next: null });
    expect(milestonePlace(path, states, "zzz")).toBeNull();
  });

  it("explains a lock", () => {
    expect(lockReason(milestonePlace(path, states, "c"))).toBe("Submit milestone 2 first.");
    expect(lockReason(milestonePlace(path, states, "b"))).toBeNull();
    expect(lockReason(null)).toBeNull();
  });
});

describe("blockingPath (path order)", () => {
  const states = (...attempted: boolean[]) =>
    milestoneStates(true, attempted.map((a, i) => m(`m${i}`, a ? [attempt(1, "submitted")] : [])));
  const required = (slug: string, s: ReturnType<typeof states>) => [slug, { slug, title: slug.toUpperCase(), states: s }] as const;

  it("holds a path back until every milestone of the required path has an attempt", () => {
    const own = states(false, false);
    expect(blockingPath(["first"], new Map([required("first", states(true, false))]), own)).toEqual({ slug: "first", title: "FIRST" });
    expect(blockingPath(["first"], new Map([required("first", states(true, true))]), own)).toBeNull();
  });

  it("counts any attempt, reviewed or not", () => {
    for (const status of ["submitted", "ai_reviewed", "needs_resubmission", "published"] as const) {
      const done = milestoneStates(true, [m("x", [attempt(1, status, status === "published" ? 20 : null)])]);
      expect(blockingPath(["first"], new Map([required("first", done)]), states(false)), status).toBeNull();
    }
  });

  it("doesn't count saved work that isn't submitted", () => {
    const saved = milestoneStates(true, [m("x", [], { hasDraft: true })]);
    expect(blockingPath(["first"], new Map([required("first", saved)]), states(false))).toEqual({ slug: "first", title: "FIRST" });
  });

  it("counts test attempts on a draft the tester is trying", () => {
    const tested = milestoneStates(true, [m("x", [attempt(1, "published")], { testing: true })]);
    expect(blockingPath(["first"], new Map([required("first", tested)]), states(false))).toBeNull();
  });

  it("names the first required path that still holds it back", () => {
    const map = new Map([required("a", states(true)), required("b", states(false)), required("c", states(false))]);
    expect(blockingPath(["a", "b", "c"], map, states(false))).toEqual({ slug: "b", title: "B" });
  });

  it("ignores a required path the learner can't see, or with no milestones they can see", () => {
    expect(blockingPath(["hidden"], new Map(), states(false))).toBeNull();
    expect(blockingPath(["empty"], new Map([required("empty", [])]), states(false))).toBeNull();
  });

  it("never locks a path the learner already has an attempt in", () => {
    expect(blockingPath(["first"], new Map([required("first", states(false))]), states(false, true))).toBeNull();
  });

  it("locks every milestone of a locked path, and the gate says what it waits for", () => {
    const locked = lockAll(states(false, false));
    expect(locked.map((s) => [s.status, s.unlocked])).toEqual([
      ["locked", false],
      ["locked", false],
    ]);
    const place = milestonePlace({ slug: "p", title: "P" }, locked, "m0", { slug: "first", title: "Connect our design systems" });
    expect(place).toMatchObject({ locked: true, lockedBy: { slug: "first" } });
    expect(lockReason(place)).toBe("Unlocks after Connect our design systems.");
  });
});
