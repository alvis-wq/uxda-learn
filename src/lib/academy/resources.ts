import { z } from "zod";
import type { Database } from "@/lib/database.types";

export type AcademyResourceRow = Database["public"]["Tables"]["academy_resources"]["Row"];

export const RESOURCE_KINDS = ["blog", "podcast", "book"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const resourceKindSchema = z.enum(RESOURCE_KINDS);

export const KIND_LABEL: Record<ResourceKind, string> = { blog: "Blog post", podcast: "Podcast", book: "Book" };

export const BOOK_CATEGORIES = ["academy", "other"] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export const BOOK_CATEGORY_LABEL: Record<BookCategory, string> = {
  academy: "UXDA Academy books",
  other: "Other insightful books",
};

/**
 * What the Academy page needs of one resource. `has_quiz` false: a podcast episode without a quiz (for now), switched
 * to done directly. `reading`: a book this user marked "Reading now".
 */
export type AcademyItem = Pick<
  AcademyResourceRow,
  "id" | "kind" | "title" | "url" | "description" | "image_path" | "author" | "category" | "blog_id" | "sort_key" | "released_on"
> & { done: boolean; has_quiz: boolean; reading: boolean };

/** Public URL of a thumbnail or cover in the `academy` bucket. */
export function academyImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/academy/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Newest first: higher sort_key first, then title for a stable order. */
export function byNewest<T extends Pick<AcademyItem, "sort_key" | "title">>(a: T, b: T): number {
  return b.sort_key - a.sort_key || a.title.localeCompare(b.title);
}

/** Podcasts: newest release first; episodes without a date after those, by episode number (their sort_key). */
export function byRelease<T extends Pick<AcademyItem, "released_on" | "sort_key" | "title">>(a: T, b: T): number {
  if (a.released_on !== b.released_on) {
    if (!a.released_on) return 1;
    if (!b.released_on) return -1;
    return b.released_on.localeCompare(a.released_on);
  }
  return byNewest(a, b);
}

/** Blog posts newest first, or podcast episodes newest release first. */
export function listOf(items: AcademyItem[], kind: "blog" | "podcast"): AcademyItem[] {
  return items.filter((i) => i.kind === kind).sort(kind === "podcast" ? byRelease : byNewest);
}

/**
 * Each blog post's podcast episode and each episode's post (by the episode's `blog_id`), both ways in one map keyed by
 * id. Only pairs where both are in `items` (published), so a card never links to something hidden.
 */
export function counterparts(items: AcademyItem[]): Map<string, AcademyItem> {
  const blogs = new Map(items.filter((i) => i.kind === "blog").map((b) => [b.id, b]));
  const out = new Map<string, AcademyItem>();
  for (const p of items) {
    const blog = p.kind === "podcast" && p.blog_id ? blogs.get(p.blog_id) : undefined;
    if (!blog) continue;
    out.set(blog.id, p);
    out.set(p.id, blog);
  }
  return out;
}

export const SHOW_FILTERS = ["all", "todo", "done"] as const;
export type ShowFilter = (typeof SHOW_FILTERS)[number];
export const SHOW_LABEL: Record<ShowFilter, string> = { all: "All", todo: "To do", done: "Done" };

export function parseShowFilter(value: unknown): ShowFilter {
  return SHOW_FILTERS.includes(value as ShowFilter) ? (value as ShowFilter) : "all";
}

function matches(item: AcademyItem | null, show: ShowFilter): boolean {
  if (!item) return false;
  return show === "all" || (show === "done") === item.done;
}

export function filterItems(items: AcademyItem[], show: ShowFilter): AcademyItem[] {
  return items.filter((i) => matches(i, show));
}

export const BOOK_FILTERS = ["all", "reading", "unread", "done"] as const;
export type BookFilter = (typeof BOOK_FILTERS)[number];
export const BOOK_FILTER_LABEL: Record<BookFilter, string> = { all: "All", reading: "Reading", unread: "Not read", done: "Done" };

export function parseBookFilter(value: unknown): BookFilter {
  return BOOK_FILTERS.includes(value as BookFilter) ? (value as BookFilter) : "all";
}

/** Reading = marked "Reading now" and not done yet; not read = neither. A finished book only counts as done. */
export function filterBooks(items: AcademyItem[], filter: BookFilter): AcademyItem[] {
  return items.filter((i) => {
    if (filter === "done") return i.done;
    if (filter === "reading") return i.reading && !i.done;
    if (filter === "unread") return !i.reading && !i.done;
    return true;
  });
}

/** Lower case, no accents: so "cafe" finds "Café". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Items whose title (or author) contains the search text; all of them for an empty search. */
export function searchItems(items: AcademyItem[], query: string): AcademyItem[] {
  const q = fold(query.trim());
  if (!q) return items;
  return items.filter((i) => fold(i.title).includes(q) || (!!i.author && fold(i.author).includes(q)));
}

export type KindProgress = { done: number; total: number };

export function progressByKind(items: AcademyItem[]): Record<ResourceKind, KindProgress> {
  const out: Record<ResourceKind, KindProgress> = { blog: { done: 0, total: 0 }, podcast: { done: 0, total: 0 }, book: { done: 0, total: 0 } };
  for (const i of items) {
    const k = i.kind as ResourceKind;
    if (!out[k]) continue;
    out[k].total++;
    if (i.done) out[k].done++;
  }
  return out;
}

/**
 * Books grouped as on the page: UXDA Academy books first, then other insightful books (uncategorised join those). In
 * reading-list order (oldest first), unlike posts: the list starts with the basics and new books join at the end.
 */
export function groupBooks(items: AcademyItem[]): { category: BookCategory; books: AcademyItem[] }[] {
  const books = items.filter((i) => i.kind === "book").sort((a, b) => -byNewest(a, b));
  return BOOK_CATEGORIES.map((category) => ({
    category,
    books: books.filter((b) => (b.category === "academy" ? "academy" : "other") === category),
  })).filter((g) => g.books.length > 0);
}

const titleWords = (s: string) =>
  fold(s)
    .split(/[^a-z]+/)
    .filter(Boolean);

/** Whether a found book title is the one we asked for: the first (up to) three words of the shorter title agree. */
export function titlesMatch(a: string, b: string): boolean {
  const [x, y] = [titleWords(a), titleWords(b)].sort((p, q) => p.length - q.length);
  if (x.length === 0) return false;
  return x.slice(0, 3).every((w, i) => y[i] === w);
}
