/**
 * Sync /content into Supabase (service role).
 *   npm run content:sync [-- --dry-run]
 * Answers and grader notes go to challenge_keys only. Removed content is archived, never deleted.
 */
import "./lib/env";
import { loadAndValidate } from "../src/lib/content";
import { countChanges, planSync } from "../src/lib/content/sync-plan";
import { toCategoryRow, toChallengeRows } from "../src/lib/content/transform";
import { adminClient } from "./lib/supabase";

const dryRun = process.argv.includes("--dry-run");
const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "content";

function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

async function main() {
  const { content, errors } = loadAndValidate(dir);
  if (errors.length > 0) {
    console.error("Content is invalid — run `npm run content:validate` for details. Nothing synced.");
    process.exit(1);
  }

  const db = adminClient();
  const [cats, chs, keys] = await Promise.all([
    db.from("categories").select("slug,title,description,audience,sort_order,archived"),
    db.from("challenges").select("slug,content_hash,version,status"),
    db.from("challenge_keys").select("challenge_slug,answer_key,grader_notes"),
  ]);
  check(cats, "read categories");
  check(chs, "read challenges");
  check(keys, "read challenge_keys");

  const plan = planSync(
    {
      categories: content.categories.map(toCategoryRow),
      challenges: content.challenges.map((c) => toChallengeRows(c, content.categories)),
    },
    { categories: cats.data ?? [], challenges: chs.data ?? [], keys: keys.data ?? [] },
  );

  for (const { row, action } of plan.categoryUpserts) console.log(`  category ${action}: ${row.slug}`);
  for (const { row, action } of plan.challengeWrites) {
    console.log(`  challenge ${action}: ${row.slug} (v${row.version}, ${row.status})`);
  }
  for (const { slug, status } of plan.challengeStatusUpdates) console.log(`  challenge status: ${slug} → ${status}`);
  for (const slug of plan.challengeArchives) console.log(`  challenge archived: ${slug}`);
  for (const slug of plan.categoryArchives) console.log(`  category archived: ${slug}`);

  const total = countChanges(plan);
  if (dryRun) {
    console.log(`Dry run: ${total} change(s) would be applied.`);
    return;
  }

  const now = new Date().toISOString();
  if (plan.categoryUpserts.length) {
    check(await db.from("categories").upsert(plan.categoryUpserts.map((u) => u.row)), "upsert categories");
  }
  for (const { row, key } of plan.challengeWrites) {
    check(
      await db.from("challenges").upsert({
        ...row,
        questions: row.questions as never,
        submission_spec: row.submission_spec as never,
        rubric: row.rubric as never,
        updated_at: now,
      }),
      `upsert challenge ${row.slug}`,
    );
    check(await db.from("challenge_keys").upsert(key), `upsert key ${row.slug}`);
  }
  for (const { slug, status } of plan.challengeStatusUpdates) {
    check(await db.from("challenges").update({ status, updated_at: now }).eq("slug", slug), `status ${slug}`);
  }
  if (plan.challengeArchives.length) {
    check(
      await db.from("challenges").update({ status: "archived", updated_at: now }).in("slug", plan.challengeArchives),
      "archive challenges",
    );
  }
  if (plan.categoryArchives.length) {
    check(
      await db.from("categories").update({ archived: true }).in("slug", plan.categoryArchives),
      "archive categories",
    );
  }

  console.log(`Sync complete: ${total} change(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
