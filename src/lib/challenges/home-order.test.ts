import { describe, expect, it } from "vitest";
import { filterByCategory, groupByCategory, homeGroup, parseHomeFilter, sortHomeChallenges, type HomeSortable } from "./home-order";

const c = (slug: string, over: Partial<HomeSortable> = {}): HomeSortable => ({
  slug, title: slug, categorySlug: "a", categoryOrder: 10, difficulty: 1, inProgress: false, savedAt: null,
  required: false, done: false, requiredState: "missing", due_at: null, ...over,
});
const order = (items: HomeSortable[]) => sortHomeChallenges(items).map((x) => x.slug);

describe("sortHomeChallenges", () => {
  it("in progress first, then required not done, then other not started, then completed last", () => {
    expect(
      order([
        c("done", { done: true }),
        c("optional"),
        c("required", { required: true }),
        c("draft", { inProgress: true, savedAt: "2026-10-13T10:00:00Z" }),
      ]),
    ).toEqual(["draft", "required", "optional", "done"]);
  });

  it("in progress: most recently saved first", () => {
    expect(
      order([
        c("old", { inProgress: true, savedAt: "2026-10-01T10:00:00Z" }),
        c("new", { inProgress: true, savedAt: "2026-10-13T10:00:00Z" }),
        c("mid", { inProgress: true, savedAt: "2026-10-07T10:00:00Z" }),
      ]),
    ).toEqual(["new", "mid", "old"]);
  });

  it("a challenge that is both in progress and required sits in the in-progress group", () => {
    const sorted = sortHomeChallenges([c("req", { required: true, due_at: "2026-01-01T00:00:00Z", requiredState: "overdue" }), c("both", { required: true, inProgress: true, savedAt: "2026-10-13T10:00:00Z" })]);
    expect(sorted.map((x) => x.slug)).toEqual(["both", "req"]);
    expect(sorted[0].required).toBe(true); // it keeps being required (the badge stays)
    expect(homeGroup(sorted[0])).toBe(0);
  });

  it("required not done: overdue first, then by due date, undated last", () => {
    expect(
      order([
        c("undated", { required: true }),
        c("later", { required: true, due_at: "2027-02-01T00:00:00Z" }),
        c("soon", { required: true, due_at: "2027-01-01T00:00:00Z" }),
        c("overdue", { required: true, requiredState: "overdue", due_at: "2026-09-01T00:00:00Z" }),
      ]),
    ).toEqual(["overdue", "soon", "later", "undated"]);
  });

  it("a required challenge awaiting review is still 'required, not done', after the ones to do", () => {
    expect(order([c("waiting", { required: true, requiredState: "pending" }), c("todo", { required: true })])).toEqual(["todo", "waiting"]);
  });

  it("not started and completed: category order, then easiest first, then title", () => {
    expect(
      order([
        c("b-hard", { categoryOrder: 20, difficulty: 3 }),
        c("a-hard", { categoryOrder: 10, difficulty: 3 }),
        c("a-easy", { categoryOrder: 10, difficulty: 1 }),
        c("z-done", { done: true, categoryOrder: 10 }),
        c("a-done", { done: true, categoryOrder: 20 }),
      ]),
    ).toEqual(["a-easy", "a-hard", "b-hard", "z-done", "a-done"]);
  });

  it("does not change its input", () => {
    const input = [c("b", { done: true }), c("a")];
    sortHomeChallenges(input);
    expect(input.map((x) => x.slug)).toEqual(["b", "a"]);
  });
});

describe("home filter", () => {
  const slugs = ["ai", "wire"];
  it("parses a known slug, and falls back to All for anything else", () => {
    expect(parseHomeFilter("ai", slugs, { tester: false })).toBe("ai");
    for (const bad of [null, undefined, "", "nope", "all", "AI"]) expect(parseHomeFilter(bad, slugs, { tester: false })).toBe("all");
  });

  it("the drafts filter is for testers only", () => {
    expect(parseHomeFilter("drafts", slugs, { tester: true })).toBe("drafts");
    expect(parseHomeFilter("drafts", slugs, { tester: false })).toBe("all");
  });

  it("filters keeping the order, and All keeps everything", () => {
    const items = [c("1", { categorySlug: "ai" }), c("2", { categorySlug: "wire" }), c("3", { categorySlug: "ai" })];
    expect(filterByCategory(items, "ai").map((x) => x.slug)).toEqual(["1", "3"]);
    expect(filterByCategory(items, "all")).toHaveLength(3);
    expect(filterByCategory(items, "wire").map((x) => x.slug)).toEqual(["2"]);
  });
});

describe("groupByCategory", () => {
  const categories = [
    { slug: "uxda", title: "The UXDA Way", completed: 1, total: 3 },
    { slug: "ai", title: "AI workflow", completed: 0, total: 2 },
    { slug: "empty", title: "Nothing visible", completed: 0, total: 0 },
  ];

  it("one group per category, in the category order, with its own done/total", () => {
    const items = [c("ai-1", { categorySlug: "ai" }), c("u-1", { categorySlug: "uxda" })];
    const groups = groupByCategory(items, categories);
    expect(groups.map((g) => [g.slug, g.title, g.completed, g.total])).toEqual([["uxda", "The UXDA Way", 1, 3], ["ai", "AI workflow", 0, 2]]);
  });

  it("keeps the sort inside each group: in progress, required not done, other, completed", () => {
    const sorted = sortHomeChallenges([
      c("done", { categorySlug: "uxda", done: true }),
      c("other", { categorySlug: "uxda" }),
      c("ai-other", { categorySlug: "ai" }),
      c("required", { categorySlug: "uxda", required: true }),
      c("started", { categorySlug: "uxda", inProgress: true, savedAt: "2026-10-13T10:00:00Z" }),
    ]);
    const groups = groupByCategory(sorted, categories);
    expect(groups[0].items.map((x) => x.slug)).toEqual(["started", "required", "other", "done"]);
    expect(groups[1].items.map((x) => x.slug)).toEqual(["ai-other"]);
  });

  it("leaves out a category with nothing in it, and gives no group to an unknown category", () => {
    const groups = groupByCategory([c("x", { categorySlug: "unknown" })], categories);
    expect(groups).toEqual([]);
  });
});
