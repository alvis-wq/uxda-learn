/**
 * Import the UXDA podcast's episodes into the Academy, each paired with its blog post where possible.
 *
 *   npm run academy:podcasts -- <file.xlsx> --as <admin email>            # dry run: the pairing it would use
 *   npm run academy:podcasts -- <file.xlsx> --as <admin email> --apply    # writes it
 *   … --feed <rss url>                                                     # another feed (default: Buzzsprout's)
 *   npm run academy:podcasts -- --dates --as <admin email> [--apply]      # fill release dates of episodes already in
 *   npm run academy:podcasts -- --links --as <admin email> [--apply]      # add Spotify and YouTube links to episodes
 *
 * Episodes come from the podcast's RSS feed (title, Buzzsprout page, cover, opening of the description). Pairing: the
 * blog link in the episode ("Read the full article…"), else the post's "Episode number" in the spreadsheet's UXDA BLOG
 * sheet, else a clearly similar title; doubtful ones stay on their own and are listed. Episodes are published without
 * a quiz (listeners switch them to done). Running it again skips episodes that are already in. Each episode gets its
 * release date (<pubDate>): the Academy lists podcasts newest release first. --dates only fills or corrects the release
 * dates of the episodes already in (matched by their Buzzsprout page), and needs no spreadsheet.
 *
 * Spotify and YouTube links are matched by episode number ("#93 …" in every title), for new episodes and with --links
 * for the ones already in; a link an editor set is never replaced. YouTube: every video when yt-dlp is installed
 * (brew install yt-dlp), else the channel's RSS feed (latest 15). Spotify: needs SPOTIFY_CLIENT_ID and
 * SPOTIFY_CLIENT_SECRET in .env.local (a free app at developer.spotify.com); without them Spotify is skipped.
 */
import { spawnSync } from "node:child_process";
import "./lib/env";
import { BLOG_SHEET, parseBlogSheet } from "./lib/academy-import";
import { arg, picture, picturePath, pool, readWorkbook } from "./lib/academy-scripts";
import { matchEpisodes, normUrl, parseFeed, type BlogRef, type FeedEpisode } from "./lib/podcast-feed";
import { byNumber, findLink, parseSpotifyEpisodes, parseYoutubeFeed, parseYtDlpList, planLinks, type ListenEntry, type ListenIndex } from "./lib/podcast-links";
import { adminClient } from "./lib/supabase";
import { safeFetch } from "../src/lib/academy/metadata";

const FEED = "https://feeds.buzzsprout.com/942295.rss";
const MAX_FEED_BYTES = 8 * 1024 * 1024;
const CONCURRENCY = 4;
const YOUTUBE_CHANNEL = "https://www.youtube.com/@uxda/videos";
const YOUTUBE_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCQ3Df4vt9yaOj5Eu08MtRxg";
const SPOTIFY_SHOW = "1zfcoHUozO0lIYltRUDEpg";

async function main() {
  const apply = process.argv.includes("--apply");
  const datesOnly = process.argv.includes("--dates");
  const linksOnly = process.argv.includes("--links");
  const actorEmail = arg("--as")?.toLowerCase();
  const feedUrl = arg("--feed") ?? FEED;
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && !["--as", "--feed"].includes(all[i - 1]));
  if ((!file && !datesOnly && !linksOnly) || !actorEmail) {
    console.error("Usage: npm run academy:podcasts -- <file.xlsx> --as <admin email> [--apply] [--feed <rss url>]");
    console.error("       npm run academy:podcasts -- --dates --as <admin email> [--apply] [--feed <rss url>]");
    console.error("       npm run academy:podcasts -- --links --as <admin email> [--apply]");
    process.exit(1);
  }
  const db = adminClient();
  const { data: actor } = await db.from("profiles").select("id,is_admin").eq("email", actorEmail).maybeSingle();
  if (!actor?.is_admin) {
    console.error(`--as ${actorEmail}: no admin with that email has signed in.`);
    process.exit(1);
  }

  if (linksOnly) return fillLinks(db, apply);
  const feed = await safeFetch(feedUrl, "application/rss+xml,application/xml,text/xml", MAX_FEED_BYTES);
  const episodes = parseFeed(new TextDecoder().decode(feed.body));
  if (datesOnly) return fillDates(db, episodes, apply);
  const sheetEpisode = new Map(parseBlogSheet((await readWorkbook(file!))(BLOG_SHEET)).map((r) => [normUrl(r.url!), r.episode ?? null]));

  const { data: rows, error } = await db.from("academy_resources").select("id,kind,url,title,blog_id,status");
  if (error) throw new Error(`read academy_resources: ${error.message}`);
  const existingUrls = new Set(rows.filter((r) => r.url).map((r) => normUrl(r.url!)));
  const hasPodcast = new Set(rows.filter((r) => r.kind === "podcast" && r.blog_id).map((r) => r.blog_id));
  const blogs: BlogRef[] = rows
    .filter((r) => r.kind === "blog" && r.status !== "archived" && r.url && !hasPodcast.has(r.id))
    .map((r) => ({ id: r.id, url: r.url!, title: r.title, sheetEpisode: sheetEpisode.get(normUrl(r.url!)) ?? null }));
  const blogTitle = new Map(blogs.map((b) => [b.id, b.title]));

  const fresh = episodes.filter((e) => !existingUrls.has(normUrl(e.pageUrl)));
  const { matches, notes } = matchEpisodes(fresh, blogs);
  const count = (how: string | null) => matches.filter((m) => m.how === how).length;
  console.log(`Feed: ${episodes.length} episodes; ${episodes.length - fresh.length} already in the Academy; ${fresh.length} to add.`);
  console.log(`Paired with a post: ${count("link")} by the link in the episode, ${count("number")} by the sheet's episode number, ${count("title")} by title; ${count(null)} on their own.\n`);
  for (const m of [...matches].sort((a, b) => (b.episode.number ?? 0) - (a.episode.number ?? 0))) {
    console.log(`  ${m.episode.title}${m.blogId ? `\n      → ${blogTitle.get(m.blogId)} (${m.how})` : "  (on its own)"}`);
  }
  if (notes.length) {
    console.log(`\nWorth a look (${notes.length}):`);
    for (const n of notes) console.log(`  ${n}`);
  }
  if (!apply) {
    console.log("\nDry run: nothing written. Add --apply to import.");
    return;
  }
  const listen = matches.length ? await loadListenLinks() : null;

  const failed: string[] = [];
  const now = new Date().toISOString();
  await pool(matches, CONCURRENCY, async ({ episode, blogId }) => {
    let imagePath: string | null = null;
    const pic = episode.imageUrl ? await picture(episode.imageUrl) : null;
    if (pic) {
      const path = picturePath(pic.type);
      const up = await db.storage.from("academy").upload(path, pic.body, { contentType: pic.type });
      if (!up.error) imagePath = path;
    }
    const { error: insertError } = await db.from("academy_resources").insert({
      kind: "podcast",
      title: episode.title,
      url: episode.pageUrl,
      description: episode.blurb,
      image_path: imagePath,
      blog_id: blogId,
      number: episode.number,
      released_on: episode.releasedOn,
      spotify_url: listen ? (findLink(listen.spotify, episode) ?? null) : null,
      youtube_url: listen ? (findLink(listen.youtube, episode) ?? null) : null,
      // Newest episode first among the ones without a post.
      sort_key: episode.number ?? 0,
      status: "published",
      published_at: now,
      created_by: actor.id,
      updated_by: actor.id,
    });
    if (insertError) failed.push(`${episode.title}: ${insertError.message}`);
    else console.log(`  ✓ ${episode.title}`);
  });
  console.log(`\nAdded ${matches.length - failed.length} episodes.`);
  if (failed.length) {
    console.log(`${failed.length} failed:`);
    for (const f of failed) console.log(`  ${f}`);
  }
}

/** --dates: set released_on on the episodes already in the Academy from the feed's <pubDate>, where it differs. */
async function fillDates(db: ReturnType<typeof adminClient>, episodes: FeedEpisode[], apply: boolean) {
  const released = new Map(episodes.filter((e) => e.releasedOn).map((e) => [normUrl(e.pageUrl), e.releasedOn!]));
  const { data: rows, error } = await db.from("academy_resources").select("id,title,url,released_on").eq("kind", "podcast");
  if (error) throw new Error(`read academy_resources: ${error.message}`);
  const changes = rows.flatMap((r) => {
    const date = r.url ? released.get(normUrl(r.url)) : undefined;
    return date && date !== r.released_on ? [{ id: r.id, title: r.title, from: r.released_on, to: date }] : [];
  });
  const missing = rows.filter((r) => !r.url || !released.has(normUrl(r.url)));
  console.log(`Podcast episodes in the Academy: ${rows.length}; ${changes.length} to date; ${missing.length} not in the feed.`);
  for (const c of changes) console.log(`  ${c.to}${c.from ? ` (was ${c.from})` : ""}  ${c.title}`);
  for (const m of missing) console.log(`  not in the feed: ${m.title}`);
  if (!apply) {
    console.log("\nDry run: nothing written. Add --apply to write the dates.");
    return;
  }
  const failed: string[] = [];
  await pool(changes, CONCURRENCY, async (c) => {
    const { error: updateError } = await db.from("academy_resources").update({ released_on: c.to }).eq("id", c.id);
    if (updateError) failed.push(`${c.title}: ${updateError.message}`);
  });
  console.log(`\nDated ${changes.length - failed.length} episodes.`);
  for (const f of failed) console.log(`  failed: ${f}`);
}

// Spotify and YouTube ------------------------------------------------------------------------------------------

/** Every video on the channel via yt-dlp when it's installed; else the channel's RSS feed (its latest 15). */
async function youtubeEntries(): Promise<{ entries: ListenEntry[]; source: string }> {
  const run = spawnSync("yt-dlp", ["--flat-playlist", "--print", "%(id)s\t%(title)s", YOUTUBE_CHANNEL], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (!run.error && run.status === 0) return { entries: parseYtDlpList(run.stdout), source: "every video, via yt-dlp" };
  const feed = await safeFetch(YOUTUBE_FEED, "application/atom+xml,application/xml,text/xml", MAX_FEED_BYTES);
  return { entries: parseYoutubeFeed(new TextDecoder().decode(feed.body)), source: "latest 15 videos, via RSS (install yt-dlp for all)" };
}

/**
 * Every episode of the show from Spotify's Web API (client credentials), or null without SPOTIFY_CLIENT_ID/SECRET.
 * Plain fetch: fixed Spotify hosts, no address from outside, and it needs a POST and an auth header.
 */
async function spotifyEntries(): Promise<ListenEntry[] | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) throw new Error(`Spotify sign-in failed (${tokenRes.status}): check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const entries: ListenEntry[] = [];
  for (let offset = 0; offset < 2000; offset += 50) {
    const res = await fetch(`https://api.spotify.com/v1/shows/${SPOTIFY_SHOW}/episodes?market=LV&limit=50&offset=${offset}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) throw new Error(`Spotify episodes failed (${res.status}).`);
    const page = (await res.json()) as { next?: string | null };
    entries.push(...parseSpotifyEpisodes(page));
    if (!page.next) break;
  }
  return entries;
}

/** Spotify and YouTube links by episode number (or title), with what was read and anything doubtful printed. */
async function loadListenLinks(): Promise<{ spotify: ListenIndex; youtube: ListenIndex; spotifyRead: boolean }> {
  const yt = await youtubeEntries();
  const sp = await spotifyEntries();
  const youtube = byNumber(yt.entries, "YouTube");
  const spotify = byNumber(sp ?? [], "Spotify");
  console.log(`YouTube: ${youtube.links.size} numbered episodes (${yt.source}).`);
  console.log(sp ? `Spotify: ${spotify.links.size} numbered episodes.` : "Spotify: skipped (no SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.local).");
  for (const n of [...youtube.notes, ...spotify.notes]) console.log(`  ${n}`);
  return { spotify, youtube, spotifyRead: sp !== null };
}

/** --links: add the Spotify and YouTube links of the episodes already in the Academy, where they have none. */
async function fillLinks(db: ReturnType<typeof adminClient>, apply: boolean) {
  const { spotify, youtube, spotifyRead } = await loadListenLinks();
  const { data: rows, error } = await db.from("academy_resources").select("id,title,number,spotify_url,youtube_url").eq("kind", "podcast");
  if (error) throw new Error(`read academy_resources: ${error.message}`);
  const { changes, notes } = planLinks(rows, spotify, youtube);
  const lacking = (field: "spotify_url" | "youtube_url") =>
    rows.filter((r) => !r[field] && !changes.some((c) => c.id === r.id && c[field])).map((r) => r.title);
  console.log(`\nPodcast episodes in the Academy: ${rows.length}; ${changes.length} get links.`);
  for (const c of changes) console.log(`  ${[c.spotify_url && "Spotify", c.youtube_url && "YouTube"].filter(Boolean).join(" + ")}  ${c.title}`);
  const noYoutube = lacking("youtube_url");
  const noSpotify = lacking("spotify_url");
  if (noYoutube.length) console.log(`\nNo YouTube video found (${noYoutube.length}): ${noYoutube.join("; ")}`);
  if (spotifyRead && noSpotify.length) console.log(`\nNo Spotify episode found (${noSpotify.length}): ${noSpotify.join("; ")}`);
  if (notes.length) {
    console.log(`\nWorth a look (${notes.length}):`);
    for (const n of notes) console.log(`  ${n}`);
  }
  if (!apply) {
    console.log("\nDry run: nothing written. Add --apply to write the links.");
    return;
  }
  const failed: string[] = [];
  await pool(changes, CONCURRENCY, async ({ id, title, ...links }) => {
    const { error: updateError } = await db.from("academy_resources").update(links).eq("id", id);
    if (updateError) failed.push(`${title}: ${updateError.message}`);
  });
  console.log(`\nLinked ${changes.length - failed.length} episodes.`);
  for (const f of failed) console.log(`  failed: ${f}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
