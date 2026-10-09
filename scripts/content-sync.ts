/**
 * Sync /content into Supabase (service role).
 *   npm run content:sync [-- --dry-run]
 * Answers and grader notes go to challenge_keys only. Removed content is archived, never deleted.
 * status / required_for / due_at come from the file only when a challenge is first created; after
 * that the admin panel owns them and this script only reports where the file disagrees.
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
    db.from("categories").select("slug,title,description,audiences,sort_order,archived"),
    db.from("challenges").select("*"),
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
    {
      categories: cats.data ?? [],
      challenges: (chs.data ?? []).map((c) => ({ ...c, questions: c.questions as never, submission_spec: c.submission_spec as never, rubric: c.rubric as never })),
      keys: keys.data ?? [],
    },
  );

  for (const { row, action } of plan.categoryUpserts) console.log(`  category ${action}: ${row.slug}`);
  for (const w of plan.challengeWrites) {
    console.log(
      w.action === "create"
        ? `  challenge create: ${w.row.slug} (v1, ${w.settings.status})`
        : `  challenge update: ${w.row.slug} (v${w.row.version}; status, required_for and due_at kept from the DB)`,
    );
  }
  for (const u of plan.challengeHashRefreshes) console.log(`  challenge hash refresh: ${u.slug} (version unchanged)`);
  for (const slug of plan.challengeArchives) console.log(`  challenge archived: ${slug}`);
  for (const slug of plan.categoryArchives) console.log(`  category archived: ${slug}`);

  const total = countChanges(plan);
  if (plan.settingsDrift.length) {
    console.log("Settings managed in the admin panel (file values ignored, DB wins):");
    for (const d of plan.settingsDrift) console.log(`  ${d.slug}: ${d.field} — file says ${d.file}, DB has ${d.db}`);
  }
  if (dryRun) {
    console.log(`Dry run: ${total} change(s) would be applied.`);
    return;
  }

  const now = new Date().toISOString();
  if (plan.categoryUpserts.length) {
    check(await db.from("categories").upsert(plan.categoryUpserts.map((u) => u.row)), "upsert categories");
  }
  for (const w of plan.challengeWrites) {
    const content = {
      ...w.row,
      questions: w.row.questions as never,
      submission_spec: w.row.submission_spec as never,
      rubric: w.row.rubric as never,
      updated_at: now,
    };
    if (w.action === "create") {
      check(await db.from("challenges").insert({ ...content, ...w.settings }), `create challenge ${w.row.slug}`);
    } else {
      // Content columns only: status / required_for / due_at belong to the admin panel.
      check(await db.from("challenges").update(content).eq("slug", w.row.slug), `update challenge ${w.row.slug}`);
    }
    check(await db.from("challenge_keys").upsert(w.key), `upsert key ${w.row.slug}`);
  }
  for (const { slug, content_hash } of plan.challengeHashRefreshes) {
    check(await db.from("challenges").update({ content_hash }).eq("slug", slug), `hash refresh ${slug}`);
  }
  for (const slug of plan.challengeArchives) {
    // Through set_challenge_setting so the archive shows up in the challenge's audit log.
    check(
      await db.rpc("set_challenge_setting", {
        p_slug: slug,
        p_field: "status",
        p_value: "archived",
        p_source: "content:sync",
      }),
      `archive challenge ${slug}`,
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
