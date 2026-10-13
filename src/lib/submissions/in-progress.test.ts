import { describe, expect, it } from "vitest";
import { inProgressChallenges } from "./in-progress";
import type { AttemptSummary } from "./rules";

const attempt = (slug: string, n: number, status: AttemptSummary["status"], score: number | null = null, max = 10) => ({
  challenge_slug: slug,
  attempt: n,
  status,
  final_score: score,
  max_score: max,
});
const challenge = (slug: string, over = {}) => ({ slug, title: `T ${slug}`, status: "published", category_slug: "cat", audiences: ["all"] as const, ...over });
const categories = [{ slug: "cat", title: "Category", archived: false, audiences: ["all"] as const }];
const base = { categories, track: "designer" as const };
const draft = (slug: string, at = "2026-10-13T10:00:00Z") => ({ challenge_slug: slug, updated_at: at });

describe("inProgressChallenges", () => {
  it("lists a draft on a challenge with no attempts, with its title, category and save time", () => {
    expect(inProgressChallenges({ ...base, drafts: [draft("a")], attempts: [], challenges: [challenge("a")] })).toEqual([
      { slug: "a", title: "T a", categoryTitle: "Category", savedAt: "2026-10-13T10:00:00Z", best: null },
    ]);
  });

  it("is empty with no drafts", () => {
    expect(inProgressChallenges({ ...base, drafts: [], attempts: [attempt("a", 1, "published", 5)], challenges: [challenge("a")] })).toEqual([]);
  });

  it("carries the best score so far when there are earlier attempts (a resubmission request, a retry)", () => {
    const rows = inProgressChallenges({
      ...base,
      drafts: [draft("a"), draft("b")],
      attempts: [attempt("a", 1, "published", 4), attempt("a", 2, "published", 7), attempt("b", 1, "needs_resubmission")],
      challenges: [challenge("a"), challenge("b")],
    });
    expect(rows.find((r) => r.slug === "a")?.best).toEqual({ score: 7, max: 10 });
    expect(rows.find((r) => r.slug === "b")?.best).toBeNull(); // nothing published yet
  });

  it("uses the same rule as the In progress badge: no open attempt, no row", () => {
    const attempts = [
      attempt("review", 1, "submitted"),
      attempt("full", 1, "published", 10),
      ...[1, 2, 3].map((n) => attempt("used", n, "published", 5)),
    ];
    const challenges = ["review", "full", "used"].map((s) => challenge(s));
    expect(inProgressChallenges({ ...base, drafts: challenges.map((c) => draft(c.slug)), attempts, challenges })).toEqual([]);
  });

  it("skips challenges the learner can no longer open (unpublished, other track, archived category, gone)", () => {
    const challenges = [
      challenge("hidden", { status: "draft" }),
      challenge("other-track", { audiences: ["strategist"] }),
      challenge("old", { category_slug: "archived" }),
    ];
    const rows = inProgressChallenges({
      ...base,
      categories: [...categories, { slug: "archived", title: "Old", archived: true, audiences: ["all"] as const }],
      drafts: [...challenges.map((c) => draft(c.slug)), draft("gone")],
      attempts: [],
      challenges,
    });
    expect(rows).toEqual([]);
  });

  it("puts the most recently saved first", () => {
    const rows = inProgressChallenges({
      ...base,
      drafts: [draft("a", "2026-10-10T09:00:00Z"), draft("b", "2026-10-13T09:00:00Z"), draft("c", "2026-10-11T09:00:00Z")],
      attempts: [],
      challenges: [challenge("a"), challenge("b"), challenge("c")],
    });
    expect(rows.map((r) => r.slug)).toEqual(["b", "c", "a"]);
  });
});
