/**
 * Import the UXDA podcast's episodes into the Academy, each paired with its blog post where possible.
 *
 *   npm run academy:podcasts -- <file.xlsx> --as <admin email>            # dry run: the pairing it would use
 *   npm run academy:podcasts -- <file.xlsx> --as <admin email> --apply    # writes it
 *   … --feed <rss url>                                                     # another feed (default: Buzzsprout's)
 *
 * Episodes come from the podcast's RSS feed (title, Buzzsprout page, cover, opening of the description). Pairing: the
 * blog link in the episode ("Read the full article…"), else the post's "Episode number" in the spreadsheet's UXDA BLOG
 * sheet, else a clearly similar title; doubtful ones stay on their own and are listed. Episodes are published without
 * a quiz (listeners switch them to done). Running it again skips episodes that are already in.
 */
import "./lib/env";
import { BLOG_SHEET, parseBlogSheet } from "./lib/academy-import";
import { arg, picture, picturePath, pool, readWorkbook } from "./lib/academy-scripts";
import { matchEpisodes, normUrl, parseFeed, type BlogRef } from "./lib/podcast-feed";
import { adminClient } from "./lib/supabase";
import { safeFetch } from "../src/lib/academy/metadata";

const FEED = "https://feeds.buzzsprout.com/942295.rss";
const MAX_FEED_BYTES = 8 * 1024 * 1024;
const CONCURRENCY = 4;

async function main() {
  const apply = process.argv.includes("--apply");
  const actorEmail = arg("--as")?.toLowerCase();
  const feedUrl = arg("--feed") ?? FEED;
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && !["--as", "--feed"].includes(all[i - 1]));
  if (!file || !actorEmail) {
    console.error("Usage: npm run academy:podcasts -- <file.xlsx> --as <admin email> [--apply] [--feed <rss url>]");
    process.exit(1);
  }
  const db = adminClient();
  const { data: actor } = await db.from("profiles").select("id,is_admin").eq("email", actorEmail).maybeSingle();
  if (!actor?.is_admin) {
    console.error(`--as ${actorEmail}: no admin with that email has signed in.`);
    process.exit(1);
  }

  const feed = await safeFetch(feedUrl, "application/rss+xml,application/xml,text/xml", MAX_FEED_BYTES);
  const episodes = parseFeed(new TextDecoder().decode(feed.body));
  const sheetEpisode = new Map(parseBlogSheet((await readWorkbook(file))(BLOG_SHEET)).map((r) => [normUrl(r.url!), r.episode ?? null]));

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

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
