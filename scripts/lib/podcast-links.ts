/**
 * Where else each UXDA podcast episode can be heard: its YouTube video and Spotify episode, matched to the Academy's
 * episodes by episode number ("#93 …" in every title). Pure functions over strings and JSON, so they're tested without
 * the network (scripts/import-podcasts.ts fetches).
 */
import { decodeEntities } from "../../src/lib/academy/metadata";
import { spotifyEpisodeUrl, youtubeVideoUrl } from "../../src/lib/academy/resources";

/** One video or episode found on YouTube or Spotify. */
export type ListenEntry = { number: number | null; title: string; url: string };

/** The episode number at the start of a title: "#93 AI in Banking" → 93. Trailers and other videos have none. */
export function titleNumber(title: string): number | null {
  const m = title.trim().match(/^#(\d+)\b/);
  return m ? Number(m[1]) : null;
}

/** `yt-dlp --flat-playlist --print "%(id)s\t%(title)s"` output: one video per line. */
export function parseYtDlpList(tsv: string): ListenEntry[] {
  return tsv.split("\n").flatMap((line) => {
    const tab = line.indexOf("\t");
    if (tab < 0) return [];
    const title = line.slice(tab + 1).trim();
    const url = youtubeVideoUrl(`https://www.youtube.com/watch?v=${line.slice(0, tab).trim()}`);
    return url && title ? [{ number: titleNumber(title), title, url }] : [];
  });
}

/** A YouTube channel's RSS feed (its latest 15 videos). */
export function parseYoutubeFeed(xml: string): ListenEntry[] {
  return xml
    .split("<entry>")
    .slice(1)
    .flatMap((raw) => {
      const id = raw.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = decodeEntities(raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim();
      const url = id ? youtubeVideoUrl(`https://www.youtube.com/watch?v=${id}`) : null;
      return url && title ? [{ number: titleNumber(title), title, url }] : [];
    });
}

/** One page of Spotify's "get show episodes" (`items`: episodes, some of them null). */
export function parseSpotifyEpisodes(page: unknown): ListenEntry[] {
  const items = (page as { items?: unknown[] } | null)?.items ?? [];
  return items.flatMap((item) => {
    const e = item as { id?: unknown; name?: unknown } | null;
    if (!e || typeof e.id !== "string" || typeof e.name !== "string") return [];
    const url = spotifyEpisodeUrl(`https://open.spotify.com/episode/${e.id}`);
    return url ? [{ number: titleNumber(e.name), title: e.name.trim(), url }] : [];
  });
}

/** A title for exact matching: without its "#93 " number, lower case, letters and digits only. */
export function titleKey(title: string): string {
  return title
    .trim()
    .replace(/^#\d+\s*/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** What was found on one site: links by episode number, and by title for the videos posted without a number. */
export type ListenIndex = { links: Map<number, string>; byTitle: Map<string, string>; notes: string[] };

/**
 * Entries by episode number (and the unnumbered ones by title). A number or title that shows up with two different
 * links (a re-upload, a cut) is left out and named in `notes`, so nothing is linked by guess.
 */
export function byNumber(entries: ListenEntry[], site: string): ListenIndex {
  const seen = new Map<number, ListenEntry[]>();
  for (const e of entries) if (e.number !== null) seen.set(e.number, [...(seen.get(e.number) ?? []), e]);
  const links = new Map<number, string>();
  const notes: string[] = [];
  for (const [n, list] of seen) {
    const urls = [...new Set(list.map((e) => e.url))];
    if (urls.length === 1) links.set(n, urls[0]);
    else notes.push(`#${n} is on ${site} ${urls.length} times (${list.map((e) => e.title).join(" / ")}): not linked`);
  }
  const titles = new Map<string, Set<string>>();
  for (const e of entries) if (e.number === null) titles.set(titleKey(e.title), (titles.get(titleKey(e.title)) ?? new Set()).add(e.url));
  const byTitle = new Map([...titles].filter(([, urls]) => urls.size === 1).map(([key, urls]) => [key, [...urls][0]]));
  return { links, byTitle, notes };
}

export type EpisodeRow = { id: string; title: string; number: number | null; spotify_url: string | null; youtube_url: string | null };
export type LinkChange = { id: string; title: string; spotify_url?: string; youtube_url?: string };

/** An episode's link on one site: by its number (stored, or at the start of its title), else by its exact title. */
export function findLink(index: Pick<ListenIndex, "links" | "byTitle">, episode: { title: string; number: number | null }): string | undefined {
  const n = episode.number ?? titleNumber(episode.title);
  return (n === null ? undefined : index.links.get(n)) ?? index.byTitle.get(titleKey(episode.title));
}

/**
 * The links to add to the Academy's episodes: only where the episode has none yet, so a link an editor set is never
 * replaced. One that differs from what was found is named in `notes` instead.
 */
export function planLinks(rows: EpisodeRow[], spotify: ListenIndex, youtube: ListenIndex): { changes: LinkChange[]; notes: string[] } {
  const changes: LinkChange[] = [];
  const notes: string[] = [];
  for (const r of rows) {
    const change: LinkChange = { id: r.id, title: r.title };
    for (const [field, found] of [
      ["spotify_url", findLink(spotify, r)],
      ["youtube_url", findLink(youtube, r)],
    ] as const) {
      if (!found) continue;
      if (!r[field]) change[field] = found;
      else if (r[field] !== found) notes.push(`${r.title}: keeps its ${field} ${r[field]} (found ${found})`);
    }
    if (change.spotify_url || change.youtube_url) changes.push(change);
  }
  return { changes, notes };
}
