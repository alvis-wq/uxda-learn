import { describe, expect, it } from "vitest";
import type { ProgressSubmission } from "@/lib/admin/required-progress";
import { buildTeamMatrix, type TeamCategory, type TeamChallenge, type TeamInput, type TeamMember, type TeamPath } from "./progress";

const anna: TeamMember = { id: "u-anna", full_name: "Anna", avatar_url: null, track: "designer" };
const liga: TeamMember = { id: "u-liga", full_name: "Liga", avatar_url: null, track: "strategist" };
const bob: TeamMember = { id: "u-bob", full_name: "Bob", avatar_url: null, track: "designer" };
const notOnboarded: TeamMember = { id: "u-new", full_name: "New", avatar_url: null, track: null };

const cat = (slug: string, sort_order: number, extra: Partial<TeamCategory> = {}): TeamCategory => ({
  slug,
  title: slug.toUpperCase(),
  sort_order,
  archived: false,
  audiences: ["all"],
  ...extra,
});

const ch = (slug: string, extra: Partial<TeamChallenge> = {}): TeamChallenge => ({
  slug,
  title: slug,
  category_slug: "ux",
  type: "screenshot",
  status: "published",
  audiences: ["all"],
  difficulty: 1,
  points: 10,
  path_slug: null,
  ...extra,
});

const sub = (user: TeamMember, slug: string, attempt: number, status: ProgressSubmission["status"], score: number | null, at?: string): ProgressSubmission => ({
  user_id: user.id,
  challenge_slug: slug,
  attempt,
  status,
  final_score: score,
  max_score: 10,
  published_at: status === "published" ? (at ?? "2026-10-01T10:00:00Z") : null,
});

const path = (slug: string, milestones: string[], extra: Partial<TeamPath> = {}): TeamPath => ({
  slug,
  title: slug,
  category_slug: "ux",
  status: "published",
  audiences: ["all"],
  sequential: true,
  milestones,
  ...extra,
});

function input(extra: Partial<TeamInput> = {}): TeamInput {
  return {
    members: [anna, liga, bob],
    categories: [cat("ux", 1)],
    challenges: [],
    paths: [],
    submissions: [],
    acknowledgements: [],
    ...extra,
  };
}

const cellOf = (m: ReturnType<typeof buildTeamMatrix>, who: TeamMember, slug: string) => {
  const cols = m.groups.flatMap((g) => g.columns);
  const row = m.rows.find((r) => r.member.id === who.id)!;
  return row.cells[cols.findIndex((c) => c.slug === slug)];
};

describe("buildTeamMatrix", () => {
  it("gives every state of a challenge cell, with the best score and first publish date", () => {
    const m = buildTeamMatrix(
      input({
        challenges: [ch("a")],
        submissions: [
          sub(anna, "a", 1, "published", 6, "2026-10-02T10:00:00Z"),
          sub(anna, "a", 2, "published", 9, "2026-10-05T10:00:00Z"),
          sub(anna, "a", 3, "submitted", null), // a retry awaiting review doesn't undo done
          sub(liga, "a", 1, "ai_reviewed", null),
          sub(bob, "a", 1, "needs_resubmission", 3),
        ],
      }),
    );
    expect(cellOf(m, anna, "a")).toEqual({ state: "done", bestScore: 9, maxPoints: 10, completedAt: "2026-10-02T10:00:00Z" });
    expect(cellOf(m, liga, "a").state).toBe("review");
    expect(cellOf(m, bob, "a")).toMatchObject({ state: "resubmit", bestScore: null, completedAt: null });
  });

  it("is not started without attempts; a read & confirm item is done once acknowledged", () => {
    const m = buildTeamMatrix(
      input({
        challenges: [ch("quiz", { type: "quiz" }), ch("policy", { type: "acknowledge", points: 0 })],
        acknowledgements: [{ user_id: anna.id, challenge_slug: "policy", acknowledged_at: "2026-10-03T08:00:00Z" }],
      }),
    );
    expect(cellOf(m, anna, "quiz").state).toBe("not_started");
    expect(cellOf(m, anna, "policy")).toEqual({ state: "done", bestScore: null, maxPoints: 0, completedAt: "2026-10-03T08:00:00Z" });
    expect(cellOf(m, liga, "policy").state).toBe("not_started");
  });

  it("marks a challenge hidden for a track that can't see it (challenge or category audience)", () => {
    const m = buildTeamMatrix(
      input({
        categories: [cat("ux", 1), cat("design", 2, { audiences: ["designer"] })],
        challenges: [ch("for-designers", { audiences: ["designer"] }), ch("in-design-cat", { category_slug: "design" })],
      }),
    );
    expect(cellOf(m, anna, "for-designers").state).toBe("not_started");
    expect(cellOf(m, liga, "for-designers").state).toBe("hidden");
    expect(cellOf(m, liga, "in-design-cat").state).toBe("hidden");
    expect(m.rows.find((r) => r.member.id === liga.id)).toMatchObject({ visible: 0, done: 0 });
    expect(m.rows.find((r) => r.member.id === anna.id)).toMatchObject({ visible: 2, done: 0 });
  });

  it("folds milestones into one path column: done, in progress (x/y) or not started", () => {
    const m = buildTeamMatrix(
      input({
        challenges: [ch("m1", { path_slug: "p" }), ch("m2", { path_slug: "p", points: 20 }), ch("solo")],
        paths: [path("p", ["m1", "m2"])],
        submissions: [
          sub(anna, "m1", 1, "published", 8, "2026-10-01T10:00:00Z"),
          sub(anna, "m2", 1, "published", 15, "2026-10-04T10:00:00Z"),
          sub(liga, "m1", 1, "submitted", null),
        ],
      }),
    );
    expect(m.groups[0].columns.map((c) => [c.kind, c.slug])).toEqual([
      ["path", "p"],
      ["challenge", "solo"],
    ]);
    expect(cellOf(m, anna, "p")).toEqual({
      state: "done",
      bestScore: 23,
      maxPoints: 30,
      completedAt: "2026-10-04T10:00:00Z",
      milestonesDone: 2,
      milestonesTotal: 2,
    });
    expect(cellOf(m, liga, "p")).toMatchObject({ state: "partial", bestScore: null, milestonesDone: 0, milestonesTotal: 2 });
    expect(cellOf(m, bob, "p")).toMatchObject({ state: "not_started", milestonesDone: 0 });
  });

  it("counts a path over the milestones this person can see, and hides it when they see none", () => {
    const m = buildTeamMatrix(
      input({
        challenges: [ch("m1", { path_slug: "p" }), ch("m2", { path_slug: "p", audiences: ["designer"] })],
        paths: [path("p", ["m1", "m2"]), path("only-designers", ["m2"], { audiences: ["designer"] })],
        submissions: [sub(liga, "m1", 1, "published", 10)],
      }),
    );
    expect(cellOf(m, liga, "p")).toMatchObject({ state: "done", milestonesDone: 1, milestonesTotal: 1 });
    expect(cellOf(m, anna, "p")).toMatchObject({ state: "not_started", milestonesTotal: 2 });
    expect(cellOf(m, liga, "only-designers").state).toBe("hidden");
  });

  it("leaves out drafts, unpublished paths and archived categories", () => {
    const m = buildTeamMatrix(
      input({
        categories: [cat("ux", 1), cat("old", 2, { archived: true })],
        challenges: [ch("live"), ch("draft", { status: "draft" }), ch("in-old", { category_slug: "old" }), ch("dm", { path_slug: "dp" })],
        paths: [path("dp", ["dm"], { status: "draft" })],
      }),
    );
    expect(m.groups.map((g) => g.slug)).toEqual(["ux"]);
    expect(m.groups[0].columns.map((c) => c.slug)).toEqual(["live"]);
  });

  it("orders categories by sort order and columns by difficulty then title; drops empty categories", () => {
    const m = buildTeamMatrix(
      input({
        categories: [cat("b", 2), cat("a", 1), cat("empty", 0)],
        challenges: [
          ch("zeta", { category_slug: "a", difficulty: 1 }),
          ch("hard", { category_slug: "a", difficulty: 3 }),
          ch("alpha", { category_slug: "a", difficulty: 1 }),
          ch("other", { category_slug: "b" }),
        ],
      }),
    );
    expect(m.groups.map((g) => g.slug)).toEqual(["a", "b"]);
    expect(m.groups[0].columns.map((c) => c.slug)).toEqual(["alpha", "zeta", "hard"]);
  });

  it("lists onboarded people by name, and filters by track (dropping columns nobody shown can see)", () => {
    const all = buildTeamMatrix(input({ members: [liga, notOnboarded, bob, anna], challenges: [ch("a"), ch("d", { audiences: ["designer"] })] }));
    expect(all.rows.map((r) => r.member.full_name)).toEqual(["Anna", "Bob", "Liga"]);

    const strategists = buildTeamMatrix(input({ challenges: [ch("a"), ch("d", { audiences: ["designer"] })] }), { track: "strategist" });
    expect(strategists.rows.map((r) => r.member.id)).toEqual([liga.id]);
    expect(strategists.groups.flatMap((g) => g.columns.map((c) => c.slug))).toEqual(["a"]);
  });

  it("narrows the columns to one category, keeping the full category list for the filter", () => {
    const m = buildTeamMatrix(
      input({
        categories: [cat("ux", 1), cat("ds", 2)],
        challenges: [ch("a"), ch("b", { category_slug: "ds" })],
        submissions: [sub(anna, "a", 1, "published", 10), sub(anna, "b", 1, "published", 10)],
      }),
      { category: "ds" },
    );
    expect(m.categories.map((c) => c.slug)).toEqual(["ux", "ds"]);
    expect(m.groups.map((g) => g.slug)).toEqual(["ds"]);
    expect(m.rows.find((r) => r.member.id === anna.id)).toMatchObject({ done: 1, visible: 1, cells: [{ state: "done" }] });
    expect(buildTeamMatrix(input({ challenges: [ch("a")] }), { category: "nope" }).groups).toEqual([]);
  });

  it("has no rows and no groups when there is nothing to show", () => {
    expect(buildTeamMatrix(input({ members: [] }))).toEqual({ groups: [], rows: [], categories: [] });
    expect(buildTeamMatrix(input()).groups).toEqual([]);
  });
});
