/**
 * Import the old "UXDA Blog and Academy reading status" spreadsheet into the Academy.
 *
 *   npm run academy:import -- <file.xlsx> --as <admin email>                      # dry run: prints the plan
 *   npm run academy:import -- <file.xlsx> --as <admin email> --apply              # writes it
 *   npm run academy:import -- <file.xlsx> --as <admin email> --apply --limit 5    # only the first 5 new resources
 *   npm run academy:import -- <file.xlsx> --check-file                            # just read the file, no database
 *
 * Reads the sheets UXDA BLOG (blog posts), UXDA ACADEMY and OTHER INSIGHTFUL BOOKS (books). For each resource not yet
 * in the Academy (posts by link, books by title) it reads the details (the post's page; Open Library for books),
 * copies the picture into the `academy` bucket, has Claude draft the quiz and publishes it, marked "not checked" for
 * an editor to look over. A resource whose quiz can't be drafted stays a draft and is listed at the end; the next run
 * tries its quiz again.
 * Then everyone marked as read becomes a completion flagged imported (no quiz). People are matched by name (see
 * matchPerson); `scripts/academy-people.json` ({ "Sheet name": "email" }) settles names that don't match on their own.
 * Running it again skips what's already there. Podcast episodes aren't in the sheet with links: add them in the app.
 */
import { existsSync, readFileSync } from "node:fs";
import "./lib/env";
import {
  ACADEMY_SHEET,
  BLOG_SHEET,
  OTHER_BOOKS_SHEET,
  matchPerson,
  parseAcademySheet,
  parseBlogSheet,
  parseOtherBooksSheet,
  resourceKey,
  titlesMatch,
  type SheetResource,
} from "./lib/academy-import";
import { arg, pool, readWorkbook } from "./lib/academy-scripts";
import { adminClient } from "./lib/supabase";
import { IMAGE_TYPES, downloadImage, lookupBook, readPage } from "../src/lib/academy/metadata";
import { splitQuiz } from "../src/lib/academy/quiz";
import { draftQuiz, type QuizSource } from "../src/lib/academy/quiz-ai";
import type { ResourceKind } from "../src/lib/academy/resources";

const MAPPING_FILE = "scripts/academy-people.json";
const CONCURRENCY = 4;

async function main() {
  const apply = process.argv.includes("--apply");
  const checkFile = process.argv.includes("--check-file");
  const actorEmail = arg("--as")?.toLowerCase();
  const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && !["--as", "--limit"].includes(all[i - 1]));
  if (!file || (!actorEmail && !checkFile)) {
    console.error("Usage: npm run academy:import -- <file.xlsx> --as <admin email> [--apply] [--limit N]");
    process.exit(1);
  }
  if (apply && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is needed to draft the quizzes. See .env.example.");
    process.exit(1);
  }

  const sheet = await readWorkbook(file);
  const fromSheet: SheetResource[] = [
    ...parseBlogSheet(sheet(BLOG_SHEET)),
    ...parseAcademySheet(sheet(ACADEMY_SHEET)),
    ...parseOtherBooksSheet(sheet(OTHER_BOOKS_SHEET)),
  ];
  if (checkFile) {
    const blogs = fromSheet.filter((r) => r.kind === "blog");
    const books = fromSheet.filter((r) => r.kind === "book");
    const reads = (rs: SheetResource[]) => rs.reduce((n, r) => n + r.people.filter((p) => p.done).length, 0);
    console.log(`${blogs.length} blog posts (${reads(blogs)} reads), ${books.length} books (${reads(books)} reads).`);
    console.log(`People: ${[...new Set(fromSheet.flatMap((r) => r.people.map((p) => p.name)))].join(", ")}`);
    for (const r of [...blogs.slice(-2), ...books.slice(0, 3)]) console.log(`  ${r.kind} #${r.number} ${r.title}${r.author ? ` / ${r.author}` : ""}`);
    return;
  }
  const mapping: Record<string, string> = existsSync(MAPPING_FILE) ? JSON.parse(readFileSync(MAPPING_FILE, "utf8")) : {};

  const db = adminClient();
  const { data: profiles, error: profilesError } = await db.from("profiles").select("id,email,full_name,is_admin");
  if (profilesError) throw new Error(`read profiles: ${profilesError.message}`);
  const actor = profiles.find((p) => p.email.toLowerCase() === actorEmail);
  if (!actor?.is_admin) {
    console.error(`--as ${actorEmail}: no admin with that email has signed in.`);
    process.exit(1);
  }
  const { data: existing, error: existingError } = await db.from("academy_resources").select("id,kind,url,title,author,description,status,questions");
  if (existingError) throw new Error(`read academy_resources: ${existingError.message}`);
  const idByKey = new Map(existing.map((r) => [resourceKey(r), r.id]));
  // A book is saved under Open Library's title, which can differ from the sheet's ("DON'T MAKE ME THINK" →
  // "Don't Make Me Think, Revisited"): find it by a matching title, when exactly one book matches.
  const existingBooks = existing.filter((r) => r.kind === "book");
  for (const r of fromSheet) {
    if (r.kind !== "book" || idByKey.has(resourceKey(r))) continue;
    const matches = existingBooks.filter((b) => titlesMatch(r.title, b.title));
    if (matches.length === 1) idByKey.set(resourceKey(r), matches[0].id);
  }

  // People
  const names = [...new Set(fromSheet.flatMap((r) => r.people.map((p) => p.name)))];
  const people = new Map<string, string>(); // sheet name -> profile id
  console.log(`People (${names.length} in the sheet):`);
  for (const name of names) {
    const m = matchPerson(name, profiles, mapping);
    if ("profile" in m) {
      people.set(name, m.profile.id);
      console.log(`  ${name.padEnd(14)} → ${m.profile.full_name} <${m.profile.email}>`);
    } else console.log(`  ${name.padEnd(14)} ✗ ${m.error}`);
  }

  const toCreate = fromSheet.filter((r) => !idByKey.has(resourceKey(r)));
  const seen = new Set<string>();
  const unique = toCreate.filter((r) => (seen.has(resourceKey(r)) ? false : (seen.add(resourceKey(r)), true)));
  const batch = unique.slice(0, limit);
  // Resources from the sheet that an earlier run saved as a draft because their quiz couldn't be drafted: try again.
  const retryIds = new Set(fromSheet.map((r) => idByKey.get(resourceKey(r))));
  const retry = existing.filter((r) => retryIds.has(r.id) && r.status === "draft" && Array.isArray(r.questions) && r.questions.length === 0);
  const blogs = fromSheet.filter((r) => r.kind === "blog").length;
  console.log(`\nResources: ${blogs} blog posts, ${fromSheet.length - blogs} books in the sheet; ${fromSheet.length - toCreate.length} already in the Academy; ${batch.length} to add${batch.length < unique.length ? ` (of ${unique.length}, --limit)` : ""}${retry.length ? `; ${retry.length} drafts without a quiz to try again` : ""}.`);
  const completions = fromSheet.flatMap((r) => r.people.filter((p) => p.done && people.has(p.name)).map((p) => ({ r, userId: people.get(p.name)! })));
  const unmatchedReads = fromSheet.reduce((n, r) => n + r.people.filter((p) => p.done && !people.has(p.name)).length, 0);
  console.log(`Completions: ${completions.length} to import${unmatchedReads ? `, ${unmatchedReads} skipped (people not matched)` : ""}.`);

  if (!apply) {
    for (const r of batch.slice(0, 15)) console.log(`  + ${r.kind.padEnd(4)} ${r.title}`);
    if (batch.length > 15) console.log(`  … and ${batch.length - 15} more`);
    console.log("\nDry run: nothing written. Add --apply to import (drafts a quiz with Claude for each new resource).");
    return;
  }

  // Resources
  const failed: string[] = [];
  const startedAt = new Date().toISOString();

  /** Claude drafts the quiz and the resource is published, marked "not checked"; if that fails it stays a draft. */
  async function quizAndPublish(id: string, label: string, source: QuizSource) {
    try {
      const quiz = await draftQuiz(source);
      const { questions, answerKey } = splitQuiz(quiz);
      const key = await db.from("academy_quiz_keys").upsert({ resource_id: id, answer_key: answerKey });
      if (key.error) throw new Error(key.error.message);
      const pub = await db
        .from("academy_resources")
        .update({ questions, quiz_reviewed: false, status: "published", published_at: startedAt })
        .eq("id", id);
      if (pub.error) throw new Error(pub.error.message);
      console.log(`  ✓ ${label}`);
    } catch (e) {
      failed.push(`${source.title}: quiz not drafted (${e instanceof Error ? e.message : e}); left as a draft`);
      console.log(`  ~ ${label}: saved as a draft without a quiz`);
    }
  }

  await pool(retry, CONCURRENCY, async (r, i) => {
    const label = `[retry ${i + 1}/${retry.length}] ${r.title}`;
    const text = r.kind === "blog" && r.url ? await readPage(r.url).then((p) => p.text).catch(() => null) : null;
    await quizAndPublish(r.id, label, { kind: r.kind as ResourceKind, title: r.title, author: r.author, description: r.description, text });
  });

  await pool(batch, CONCURRENCY, async (r, i) => {
    const label = `[${i + 1}/${batch.length}] ${r.title}`;
    try {
      let title = r.title;
      let author = r.author;
      let description: string | null = null;
      let imageUrl: string | null = null;
      let text: string | null = null;
      if (r.kind === "blog") {
        const page = await readPage(r.url!);
        description = page.description;
        imageUrl = page.imageUrl;
        text = page.text;
      } else {
        const book = await lookupBook({ title: r.title, author: r.author, url: r.url }).catch(() => null);
        if (book && titlesMatch(r.title, book.title)) {
          title = book.title;
          author = author ?? book.author;
          description = book.description;
          imageUrl = book.coverUrl;
        }
      }
      let imagePath: string | null = null;
      if (imageUrl) {
        const pic = await downloadImage(imageUrl).catch(() => null);
        if (pic) {
          imagePath = `img/${crypto.randomUUID()}.${IMAGE_TYPES[pic.type]}`;
          const up = await db.storage.from("academy").upload(imagePath, pic.body, { contentType: pic.type });
          if (up.error) imagePath = null;
        }
      }
      const { data: row, error } = await db
        .from("academy_resources")
        .insert({
          kind: r.kind,
          title,
          url: r.url,
          description,
          author: r.kind === "book" ? author : null,
          category: r.category,
          number: r.number,
          image_path: imagePath,
          // Spreadsheet order; anything added in the app later sorts above (sort_key defaults to the epoch).
          sort_key: r.number ?? 0,
          created_by: actor.id,
          updated_by: actor.id,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(`insert: ${error?.message}`);
      idByKey.set(resourceKey(r), row.id);

      await quizAndPublish(row.id, label, { kind: r.kind, title, author, description, text });
    } catch (e) {
      failed.push(`${r.title}: ${e instanceof Error ? e.message : e}`);
      console.log(`  ✗ ${label}`);
    }
  });

  // Completions (for resources that exist now; already-completed ones are left alone)
  const rows = completions
    .map(({ r, userId }) => ({ user_id: userId, resource_id: idByKey.get(resourceKey(r)), is_imported: true, completed_at: startedAt }))
    .filter((c): c is { user_id: string; resource_id: string; is_imported: true; completed_at: string } => !!c.resource_id);
  const unique2 = [...new Map(rows.map((c) => [`${c.user_id}:${c.resource_id}`, c])).values()];
  for (let i = 0; i < unique2.length; i += 500) {
    const { error } = await db.from("academy_completions").upsert(unique2.slice(i, i + 500), { onConflict: "user_id,resource_id", ignoreDuplicates: true });
    if (error) throw new Error(`completions: ${error.message}`);
  }
  console.log(`\nImported ${unique2.length} completions.`);
  if (failed.length) {
    console.log(`\n${failed.length} need a look in Admin → Academy:`);
    for (const f of failed) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
