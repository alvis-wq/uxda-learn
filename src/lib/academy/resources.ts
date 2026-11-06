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
  | "id"
  | "kind"
  | "title"
  | "url"
  | "description"
  | "image_path"
  | "author"
  | "category"
  | "blog_id"
  | "sort_key"
  | "released_on"
  | "spotify_url"
  | "youtube_url"
> & { done: boolean; has_quiz: boolean; reading: boolean };

// Where the podcast can be heard -------------------------------------------------------------------------------

/** The UXDA podcast as a whole on Spotify and YouTube (the Podcasts tab links to both). */
export const PODCAST_SHOWS = [
  { service: "spotify", label: "Spotify", url: "https://open.spotify.com/show/1zfcoHUozO0lIYltRUDEpg" },
  { service: "youtube", label: "YouTube", url: "https://www.youtube.com/@uxda/videos" },
] as const;

export type ListenService = "spotify" | "youtube" | "buzzsprout";
export const LISTEN_LABEL: Record<ListenService, string> = { spotify: "Spotify", youtube: "YouTube", buzzsprout: "Buzzsprout" };

export type ListenLink = { service: ListenService; url: string; /** The whole show, not this episode. */ show: boolean };

/**
 * An episode's places to listen, in the order people most likely want them: Spotify, YouTube, then Buzzsprout. Spotify
 * is always there: the episode's own link when an editor set one, else the show (episode links need Spotify's Web API).
 */
export function listenLinks(item: Pick<AcademyItem, "url" | "spotify_url" | "youtube_url">): ListenLink[] {
  const links: { service: ListenService; url: string | null; show: boolean }[] = [
    { service: "spotify", url: item.spotify_url ?? PODCAST_SHOWS[0].url, show: !item.spotify_url },
    { service: "youtube", url: item.youtube_url, show: false },
    { service: "buzzsprout", url: item.url, show: false },
  ];
  return links.filter((l): l is ListenLink => !!l.url);
}

/** Where an episode opens (its title, a post's "Listen to podcast"): the first link to this very episode. */
export function episodeUrl(item: Pick<AcademyItem, "url" | "spotify_url" | "youtube_url">): string | null {
  return listenLinks(item).find((l) => !l.show)?.url ?? null;
}

/** A Spotify episode link in its plain form (open.spotify.com/episode/<id>, no ?si=…), or null if it isn't one. */
export function spotifyEpisodeUrl(input: string): string | null {
  const m = input.trim().match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?episode\/([A-Za-z0-9]+)(?:[?#].*)?$/i);
  return m ? `https://open.spotify.com/episode/${m[1]}` : null;
}

/** A YouTube video link (watch?v=, youtu.be/, /live/ or /shorts/) as www.youtube.com/watch?v=<id>, or null. */
export function youtubeVideoUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(host)) {
    id = u.pathname === "/watch" ? u.searchParams.get("v") : (u.pathname.match(/^\/(?:live|shorts)\/([^/]+)/)?.[1] ?? null);
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

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
