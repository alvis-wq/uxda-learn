import { describe, expect, it } from "vitest";
import { academyImageUrl, filterRows, groupBooks, pairBlogsAndPodcasts, parseShowFilter, progressByKind, type AcademyItem } from "./resources";

function item(id: string, kind: AcademyItem["kind"], sort_key: number, extra: Partial<AcademyItem> = {}): AcademyItem {
  return { id, kind, title: id, url: null, description: null, image_path: null, author: null, category: null, blog_id: null, sort_key, done: false, ...extra };
}

describe("pairBlogsAndPodcasts", () => {
  it("puts each podcast in its blog post's row, newest post first, unlinked episodes last", () => {
    const rows = pairBlogsAndPodcasts([
      item("old-post", "blog", 1),
      item("new-post", "blog", 2),
      item("pod-old", "podcast", 5, { blog_id: "old-post" }),
      item("pod-alone", "podcast", 3),
      item("pod-hidden-post", "podcast", 4, { blog_id: "draft-post" }),
      item("a-book", "book", 9),
    ]);
    expect(rows.map((r) => [r.blog?.id ?? null, r.podcast?.id ?? null])).toEqual([
      ["new-post", null],
      ["old-post", "pod-old"],
      [null, "pod-hidden-post"],
      [null, "pod-alone"],
    ]);
  });
});

describe("filterRows", () => {
  const rows = pairBlogsAndPodcasts([
    item("p1", "blog", 2, { done: true }),
    item("e1", "podcast", 2, { blog_id: "p1" }),
    item("p2", "blog", 1),
  ]);
  it("keeps a row when either side matches and hides the side that doesn't", () => {
    expect(filterRows(rows, "all")).toBe(rows);
    expect(filterRows(rows, "done").map((r) => [r.blog?.id ?? null, r.podcast?.id ?? null])).toEqual([["p1", null]]);
    expect(filterRows(rows, "todo").map((r) => [r.blog?.id ?? null, r.podcast?.id ?? null])).toEqual([
      [null, "e1"],
      ["p2", null],
    ]);
  });
});

describe("progressByKind", () => {
  it("counts done and total per kind", () => {
    expect(progressByKind([item("a", "blog", 1, { done: true }), item("b", "blog", 2), item("c", "book", 1)])).toEqual({
      blog: { done: 1, total: 2 },
      podcast: { done: 0, total: 0 },
      book: { done: 0, total: 1 },
    });
  });
});

describe("groupBooks", () => {
  it("lists Academy books first, in reading-list order; uncategorised books join the other group", () => {
    const groups = groupBooks([
      item("other-2", "book", 2, { category: "other" }),
      item("acad-2", "book", 2, { category: "academy" }),
      item("acad-1", "book", 1, { category: "academy" }),
      item("loose", "book", 3),
      item("post", "blog", 1),
    ]);
    expect(groups.map((g) => [g.category, g.books.map((b) => b.id)])).toEqual([
      ["academy", ["acad-1", "acad-2"]],
      ["other", ["other-2", "loose"]],
    ]);
  });
});

describe("parseShowFilter / academyImageUrl", () => {
  it("falls back to all for anything unknown", () => {
    expect(parseShowFilter("todo")).toBe("todo");
    expect(parseShowFilter("nope")).toBe("all");
    expect(parseShowFilter(undefined)).toBe("all");
  });
  it("builds a public bucket URL, or null without a path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(academyImageUrl("blog/a b.png")).toBe("https://x.supabase.co/storage/v1/object/public/academy/blog/a%20b.png");
    expect(academyImageUrl(null)).toBeNull();
  });
});
