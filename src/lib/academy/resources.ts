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

/** What the Academy page needs of one resource. */
export type AcademyItem = Pick<
  AcademyResourceRow,
  "id" | "kind" | "title" | "url" | "description" | "image_path" | "author" | "category" | "blog_id" | "sort_key"
> & { done: boolean };

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

export type BlogPodRow = { blog: AcademyItem | null; podcast: AcademyItem | null };

/**
 * The "Blog & Pod" rows: each blog post with the podcast episode about it in the same row, newest post first. Podcast
 * episodes that aren't linked to a (visible) post come last, one per row, with an empty blog cell.
 */
export function pairBlogsAndPodcasts(items: AcademyItem[]): BlogPodRow[] {
  const blogs = items.filter((i) => i.kind === "blog").sort(byNewest);
  const podcasts = items.filter((i) => i.kind === "podcast").sort(byNewest);
  const blogIds = new Set(blogs.map((b) => b.id));
  const podcastByBlog = new Map(podcasts.filter((p) => p.blog_id && blogIds.has(p.blog_id)).map((p) => [p.blog_id!, p]));
  const rows: BlogPodRow[] = blogs.map((blog) => ({ blog, podcast: podcastByBlog.get(blog.id) ?? null }));
  for (const p of podcasts) if (!p.blog_id || !blogIds.has(p.blog_id)) rows.push({ blog: null, podcast: p });
  return rows;
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

/** A row stays when either side matches; the side that doesn't is hidden (null). */
export function filterRows(rows: BlogPodRow[], show: ShowFilter): BlogPodRow[] {
  if (show === "all") return rows;
  return rows
    .map((r) => ({ blog: matches(r.blog, show) ? r.blog : null, podcast: matches(r.podcast, show) ? r.podcast : null }))
    .filter((r) => r.blog || r.podcast);
}

export function filterItems(items: AcademyItem[], show: ShowFilter): AcademyItem[] {
  return items.filter((i) => matches(i, show));
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
