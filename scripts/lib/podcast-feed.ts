/**
 * The UXDA podcast's RSS feed (Buzzsprout) as plain episodes, and pairing each episode with its blog post in the
 * Academy. Pure functions over strings, so they're tested without the network (scripts/import-podcasts.ts fetches).
 */
import { decodeEntities, extractText } from "../../src/lib/academy/metadata";

export type FeedEpisode = {
  number: number | null;
  title: string;
  /** The episode's page on Buzzsprout (its player). */
  pageUrl: string;
  imageUrl: string | null;
  /** A theuxda.com blog link from the episode's <link> or its description ("Read the full article…"). */
  blogUrl: string | null;
  blurb: string | null;
};

const tag = (item: string, name: string) => item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1]?.trim();
const cdata = (s: string) => s.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
const BLOG_LINK = /^https?:\/\/(www\.)?theuxda\.com\/blog\/[^\s"'<>]+/i;

/** A link's identity for matching: no scheme, www, query, hash or trailing slash; lower case. */
export const normUrl = (u: string) => u.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

/**
 * The opening of an episode's description, as plain text: up to the "Find out:" list or "Read the full article"
 * line, at most about 400 characters, cut at a sentence end.
 */
export function episodeBlurb(html: string): string | null {
  const paragraphs = extractText(html).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const p of paragraphs) {
    if (/^(find out|read the full article|\*\s*ai podcast|in this episode, you.ll)/i.test(p)) break;
    kept.push(p);
  }
  let text = kept.join(" ").replace(/\s+/g, " ").trim();
  if (text.length > 400) {
    const cut = text.slice(0, 400);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
  }
  return text || null;
}

export function parseFeed(xml: string): FeedEpisode[] {
  return xml
    .split("<item>")
    .slice(1)
    .map((raw) => {
      const item = raw.split("</item>")[0];
      const title = decodeEntities(cdata(tag(item, "title") ?? "")).trim();
      const enclosure = item.match(/<enclosure\b[^>]*\burl="([^"]+)"/)?.[1];
      const description = cdata(tag(item, "description") ?? "");
      const hrefs = [...description.matchAll(/href=["']([^"']+)["']/g)].map((m) => decodeEntities(m[1]));
      const link = decodeEntities(tag(item, "link") ?? "");
      const episode = Number(tag(item, "itunes:episode") ?? title.match(/^#(\d+)/)?.[1] ?? NaN);
      return {
        number: Number.isInteger(episode) ? episode : null,
        title,
        pageUrl: enclosure ? decodeEntities(enclosure).replace(/\.mp3(\?.*)?$/, "") : "",
        imageUrl: item.match(/<itunes:image\b[^>]*\bhref="([^"]+)"/)?.[1] ?? null,
        blogUrl: [link, ...hrefs].find((u) => BLOG_LINK.test(u)) ?? null,
        blurb: episodeBlurb(description),
      };
    })
    .filter((e) => e.title && e.pageUrl);
}

// Pairing --------------------------------------------------------------------------------------------------------

/** An Academy blog post, with the "Episode number" cell its spreadsheet row has ("88", "v" or null). */
export type BlogRef = { id: string; url: string; title: string; sheetEpisode: string | null };

export type EpisodeMatch = { episode: FeedEpisode; blogId: string | null; how: "link" | "number" | "title" | null };

const STOP = new Set(["a", "an", "the", "of", "to", "in", "and", "or", "for", "is", "are", "how", "why", "what", "with", "your", "you", "on", "can", "it", "its", "do", "does", "from", "by", "vs", "s"]);
const titleWords = (s: string) =>
  new Set(
    s
      .replace(/^#\d+\s*/, "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w)),
  );

/** How alike two titles are: shared words over all words (stop words left out), 0–1. */
export function titleSimilarity(a: string, b: string): number {
  const [x, y] = [titleWords(a), titleWords(b)];
  const shared = [...x].filter((w) => y.has(w)).length;
  const all = new Set([...x, ...y]).size;
  return all ? shared / all : 0;
}

const SURE = 0.5;
const MAYBE = 0.3;

/**
 * Pair episodes with posts: by the blog link in the episode, else by the post's episode number in the sheet, else by
 * a clearly similar title. One episode per post. Anything doubtful stays unpaired and is explained in `notes`.
 */
export function matchEpisodes(episodes: FeedEpisode[], blogs: BlogRef[]): { matches: EpisodeMatch[]; notes: string[] } {
  const byUrl = new Map(blogs.map((b) => [normUrl(b.url), b]));
  const byNumber = new Map<number, BlogRef>();
  for (const b of blogs) {
    const n = Number(b.sheetEpisode);
    if (b.sheetEpisode && Number.isInteger(n)) byNumber.set(n, b);
  }
  const taken = new Map<string, FeedEpisode>();
  const notes: string[] = [];
  const label = (e: FeedEpisode) => (e.number ? `#${e.number}` : e.title);

  // When two episodes claim one post (a re-recording), the one the sheet names by number keeps it, else the older one.
  const sheetNamed = (e: FeedEpisode) => {
    const viaLink = e.blogUrl ? byUrl.get(normUrl(e.blogUrl)) : undefined;
    return !!viaLink && !!e.number && byNumber.get(e.number)?.id === viaLink.id;
  };
  const ordered = [...episodes].sort((a, b) => Number(sheetNamed(b)) - Number(sheetNamed(a)) || (a.number ?? Infinity) - (b.number ?? Infinity));
  const matches: EpisodeMatch[] = [];
  for (const episode of ordered) {
    const viaLink = episode.blogUrl ? byUrl.get(normUrl(episode.blogUrl)) : undefined;
    const viaNumber = episode.number ? byNumber.get(episode.number) : undefined;
    let blog: BlogRef | undefined;
    let how: EpisodeMatch["how"] = null;
    if (viaLink) {
      [blog, how] = [viaLink, "link"];
      if (viaNumber && viaNumber.id !== viaLink.id) notes.push(`${label(episode)} links to "${viaLink.title}", but the sheet gives that number to "${viaNumber.title}": went with the link`);
    } else if (viaNumber) {
      [blog, how] = [viaNumber, "number"];
    } else {
      const ranked = blogs
        .filter((b) => !taken.has(b.id))
        .map((b) => ({ b, score: titleSimilarity(episode.title, b.title) }))
        .sort((p, q) => q.score - p.score);
      const [best, second] = ranked;
      if (best && best.score >= SURE && (!second || best.score - second.score >= 0.15)) [blog, how] = [best.b, "title"];
      else if (best && best.score >= MAYBE) notes.push(`${label(episode)} "${episode.title}" might be "${best.b.title}": left on its own, pair it in Admin → Academy if so`);
      else if (episode.blogUrl) notes.push(`${label(episode)} links to ${episode.blogUrl}, which isn't in the Academy: left on its own`);
    }
    if (blog && taken.has(blog.id)) {
      notes.push(`${label(episode)} and ${label(taken.get(blog.id)!)} both belong to "${blog.title}": ${label(episode)} left on its own`);
      [blog, how] = [undefined, null];
    }
    if (blog) taken.set(blog.id, episode);
    matches.push({ episode, blogId: blog?.id ?? null, how });
  }

  matches.sort((a, b) => (a.episode.number ?? Infinity) - (b.episode.number ?? Infinity));
  for (const b of blogs) {
    if (b.sheetEpisode && !taken.has(b.id)) notes.push(`"${b.title}" has episode ${b.sheetEpisode === "v" ? "(no number)" : `#${b.sheetEpisode}`} in the sheet, but no episode in the feed was paired with it`);
  }
  return { matches, notes };
}
