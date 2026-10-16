import { describe, expect, it } from "vitest";
import {
  filterByCategory,
  groupByCategory,
  groupChains,
  homeGroup,
  isCompletedOnHome,
  parseHomeFilter,
  pathChains,
  sortHomeChallenges,
  type ChainPlace,
  type HomeSortable,
} from "./home-order";

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

describe("pathChains", () => {
  const designer = [
    { slug: "build-with-the-template", requires: ["brand-the-template"] },
    { slug: "other", requires: [] },
    { slug: "brand-the-template", requires: ["connect-design-systems"] },
    { slug: "connect-design-systems", requires: [] },
  ];

  it("puts linked paths in one chain, in unlock order, whatever order they come in", () => {
    const chains = pathChains(designer);
    expect(chains.get("connect-design-systems")).toEqual({ id: "connect-design-systems", step: 1, of: 3 });
    expect(chains.get("brand-the-template")).toEqual({ id: "connect-design-systems", step: 2, of: 3 });
    expect(chains.get("build-with-the-template")).toEqual({ id: "connect-design-systems", step: 3, of: 3 });
  });

  it("leaves a path on its own out of any chain", () => {
    expect(pathChains(designer).has("other")).toBe(false);
  });

  it("only counts links between the given paths (one the learner can't see breaks the chain there)", () => {
    const chains = pathChains(designer.filter((p) => p.slug !== "brand-the-template"));
    expect(chains.size).toBe(0);
    const two = pathChains(designer.filter((p) => p.slug !== "connect-design-systems"));
    expect(two.get("brand-the-template")).toEqual({ id: "brand-the-template", step: 1, of: 2 });
    expect(two.get("build-with-the-template")).toEqual({ id: "brand-the-template", step: 2, of: 2 });
  });

  it("keeps separate chains apart, and orders a path that requires two after both", () => {
    const chains = pathChains([
      { slug: "c", requires: ["a", "b"] },
      { slug: "b", requires: [] },
      { slug: "a", requires: [] },
      { slug: "y", requires: ["x"] },
      { slug: "x", requires: [] },
    ]);
    expect(["b", "a", "c"].map((s) => chains.get(s)?.step)).toEqual([1, 2, 3]);
    expect(chains.get("y")).toEqual({ id: "x", step: 2, of: 2 });
  });
});

describe("groupChains", () => {
  type Item = { slug: string; chain: ChainPlace | null; done: boolean };
  const link = (id: string, step: number, of = 3) => ({ id, step, of });
  const item = (slug: string, chain: ChainPlace | null = null, done = false): Item => ({ slug, chain, done });
  const group = (sorted: Item[]) => groupChains(sorted, (i) => i.chain, (i) => i.done).map((i) => i.slug);

  it("shows a chain's cards together in step order, where the step the learner is on sorts", () => {
    const sorted = [
      item("in-progress"),
      item("brand", link("connect", 2)),
      item("quiz"),
      item("connect", link("connect", 1)),
      item("build", link("connect", 3)),
      item("done-one"),
    ];
    // Nothing done: the learner is on step 1.
    expect(group(sorted)).toEqual(["in-progress", "quiz", "connect", "brand", "build", "done-one"]);
  });

  it("moves up with the first step that isn't done, even when step 1 sorts with the completed cards", () => {
    const sorted = [
      item("brand", link("connect", 2)), // in progress, sorted first
      item("quiz"),
      item("build", link("connect", 3)),
      item("done-one", null, true),
      item("connect", link("connect", 1), true), // done, sorted with the completed ones
    ];
    expect(group(sorted)).toEqual(["connect", "brand", "build", "quiz", "done-one"]);
  });

  it("sits where step 1 sorts once every step is done", () => {
    const sorted = [
      item("quiz"),
      item("done-one", null, true),
      item("build", link("connect", 3), true),
      item("connect", link("connect", 1), true),
      item("brand", link("connect", 2), true),
    ];
    expect(group(sorted)).toEqual(["quiz", "done-one", "connect", "brand", "build"]);
  });

  it("anchors on the first step in the list that isn't done when step 1 isn't in it", () => {
    const sorted = [item("build", link("connect", 3)), item("quiz"), item("brand", link("connect", 2))];
    expect(group(sorted)).toEqual(["quiz", "brand", "build"]);
  });

  it("leaves a list without chains as it is", () => {
    expect(group([item("a"), item("b"), item("c")])).toEqual(["a", "b", "c"]);
  });
});

describe("isCompletedOnHome", () => {
  const item = (over: Partial<{ done: boolean; inProgress: boolean; latestStatus: "submitted" | "ai_reviewed" | "published" | "needs_resubmission" | null }> = {}) => ({
    done: false,
    inProgress: false,
    latestStatus: null,
    ...over,
  });

  it("is completed with a published score, once acknowledged, or as a path with every milestone published", () => {
    expect(isCompletedOnHome(item({ done: true, latestStatus: "published" }))).toBe(true);
    expect(isCompletedOnHome(item({ done: true }))).toBe(true); // acknowledged: no attempts
    expect(isCompletedOnHome({ done: true, inProgress: false })).toBe(true); // a path: no latestStatus
  });

  it("keeps not started, in progress, awaiting review and resubmission requested", () => {
    expect(isCompletedOnHome(item())).toBe(false);
    expect(isCompletedOnHome(item({ inProgress: true }))).toBe(false);
    expect(isCompletedOnHome(item({ latestStatus: "submitted" }))).toBe(false);
    expect(isCompletedOnHome(item({ latestStatus: "needs_resubmission" }))).toBe(false);
  });

  it("keeps a challenge that has a score while the learner is on it again (saved retry, retry awaiting review or sent back)", () => {
    expect(isCompletedOnHome(item({ done: true, inProgress: true, latestStatus: "published" }))).toBe(false);
    expect(isCompletedOnHome(item({ done: true, latestStatus: "submitted" }))).toBe(false);
    expect(isCompletedOnHome(item({ done: true, latestStatus: "ai_reviewed" }))).toBe(false);
    expect(isCompletedOnHome(item({ done: true, latestStatus: "needs_resubmission" }))).toBe(false);
  });

  it("a chain loses its completed paths and keeps the rest in order with their own step numbers", () => {
    const paths = [
      { slug: "connect", requires: [] },
      { slug: "brand", requires: ["connect"] },
      { slug: "build", requires: ["brand"] },
    ];
    const chains = pathChains(paths);
    const cards = [
      { slug: "brand", done: false, inProgress: true, chain: chains.get("brand")! },
      { slug: "build", done: false, inProgress: false, chain: chains.get("build")! },
      { slug: "connect", done: true, inProgress: false, chain: chains.get("connect")! },
    ];
    const open = groupChains(cards, (c) => c.chain, (c) => c.done).filter((c) => !isCompletedOnHome(c));
    expect(open.map((c) => [c.slug, c.chain.step, c.chain.of])).toEqual([
      ["brand", 2, 3],
      ["build", 3, 3],
    ]);
  });
});
