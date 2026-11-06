import { describe, expect, it } from "vitest";
import {
  academyImageUrl,
  counterparts,
  filterBooks,
  groupBooks,
  listenLinks,
  listOf,
  parseBookFilter,
  parseShowFilter,
  progressByKind,
  searchItems,
  spotifyEpisodeUrl,
  youtubeVideoUrl,
  type AcademyItem,
} from "./resources";

function item(id: string, kind: AcademyItem["kind"], sort_key: number, extra: Partial<AcademyItem> = {}): AcademyItem {
  return { id, kind, title: id, url: null, description: null, image_path: null, author: null, category: null, blog_id: null, sort_key, released_on: null, spotify_url: null, youtube_url: null, done: false, has_quiz: true, reading: false, ...extra };
}

describe("listOf", () => {
  it("lists blog posts newest first", () => {
    const items = [item("old", "blog", 1), item("new", "blog", 2), item("pod", "podcast", 3), item("book", "book", 9)];
    expect(listOf(items, "blog").map((i) => i.id)).toEqual(["new", "old"]);
  });
  it("lists podcasts by release date, newest first; undated ones after, by episode number", () => {
    const items = [
      item("ep-10", "podcast", 10),
      item("jan", "podcast", 1, { released_on: "2026-01-05" }),
      item("ep-12", "podcast", 12),
      item("mar", "podcast", 2, { released_on: "2026-03-01" }),
    ];
    expect(listOf(items, "podcast").map((i) => i.id)).toEqual(["mar", "jan", "ep-12", "ep-10"]);
  });
});

describe("counterparts", () => {
  it("links a post and its episode both ways, only when both are listed", () => {
    const post = item("post", "blog", 1);
    const pod = item("pod", "podcast", 1, { blog_id: "post" });
    const orphan = item("orphan", "podcast", 2, { blog_id: "draft-post" });
    const map = counterparts([post, pod, orphan, item("lonely", "blog", 2)]);
    expect(map.get("post")).toBe(pod);
    expect(map.get("pod")).toBe(post);
    expect(map.has("orphan")).toBe(false);
    expect(map.has("lonely")).toBe(false);
  });
});

describe("filterBooks", () => {
  const books = [
    item("done", "book", 1, { done: true, reading: true }),
    item("reading", "book", 2, { reading: true }),
    item("unread", "book", 3),
  ];
  it("splits books into reading, not read and done; a finished book is only done", () => {
    expect(filterBooks(books, "all").map((b) => b.id)).toEqual(["done", "reading", "unread"]);
    expect(filterBooks(books, "reading").map((b) => b.id)).toEqual(["reading"]);
    expect(filterBooks(books, "unread").map((b) => b.id)).toEqual(["unread"]);
    expect(filterBooks(books, "done").map((b) => b.id)).toEqual(["done"]);
  });
});

describe("searchItems", () => {
  const items = [item("Café Design", "blog", 1), item("Atomic Habits", "book", 2, { author: "James Clear" }), item("Other", "blog", 3)];
  it("matches title or author, ignoring case and accents; empty finds everything", () => {
    expect(searchItems(items, "cafe").map((i) => i.id)).toEqual(["Café Design"]);
    expect(searchItems(items, "  CLEAR ").map((i) => i.id)).toEqual(["Atomic Habits"]);
    expect(searchItems(items, "")).toBe(items);
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

describe("parseShowFilter / parseBookFilter / academyImageUrl", () => {
  it("falls back to all for anything unknown", () => {
    expect(parseBookFilter("reading")).toBe("reading");
    expect(parseBookFilter("todo")).toBe("all");
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

describe("listenLinks", () => {
  it("lists Spotify, YouTube, then Buzzsprout, leaving out the missing ones", () => {
    const ep = { url: "https://www.buzzsprout.com/1/episodes/2", spotify_url: "https://open.spotify.com/episode/abc", youtube_url: null };
    expect(listenLinks(ep).map((l) => l.service)).toEqual(["spotify", "buzzsprout"]);
    expect(listenLinks({ url: null, spotify_url: null, youtube_url: "https://www.youtube.com/watch?v=xyz123" })).toEqual([
      { service: "youtube", url: "https://www.youtube.com/watch?v=xyz123" },
    ]);
  });
});

describe("spotifyEpisodeUrl", () => {
  it("keeps the episode id and drops the tracking query", () => {
    expect(spotifyEpisodeUrl(" https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc ")).toBe("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk");
    expect(spotifyEpisodeUrl("https://open.spotify.com/intl-de/episode/4rOoJ6Egrf8K2IrywzwOMk")).toBe("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk");
  });
  it("refuses shows, other sites and plain http", () => {
    expect(spotifyEpisodeUrl("https://open.spotify.com/show/1zfcoHUozO0lIYltRUDEpg")).toBeNull();
    expect(spotifyEpisodeUrl("https://evil.example/episode/abc")).toBeNull();
    expect(spotifyEpisodeUrl("http://open.spotify.com/episode/abc")).toBeNull();
  });
});

describe("youtubeVideoUrl", () => {
  it("reads watch, youtu.be, live and shorts links", () => {
    const want = "https://www.youtube.com/watch?v=dwopD7vNhCs";
    expect(youtubeVideoUrl("https://www.youtube.com/watch?v=dwopD7vNhCs&t=42s")).toBe(want);
    expect(youtubeVideoUrl("https://youtu.be/dwopD7vNhCs?si=x")).toBe(want);
    expect(youtubeVideoUrl("https://m.youtube.com/watch?v=dwopD7vNhCs")).toBe(want);
    expect(youtubeVideoUrl("https://www.youtube.com/live/dwopD7vNhCs")).toBe(want);
  });
  it("refuses channels, other sites and nonsense", () => {
    expect(youtubeVideoUrl("https://www.youtube.com/@uxda/videos")).toBeNull();
    expect(youtubeVideoUrl("https://youtube.evil.example/watch?v=dwopD7vNhCs")).toBeNull();
    expect(youtubeVideoUrl("javascript:alert(1)")).toBeNull();
    expect(youtubeVideoUrl("not a link")).toBeNull();
  });
});
