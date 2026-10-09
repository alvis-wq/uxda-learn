import path from "node:path";
import { loadAndValidate } from "../src/lib/content";
import { toCategoryRow, toChallengeRows } from "../src/lib/content/transform";
import { adminDb, profileId, TEST_EMAILS } from "./helpers";

const FIXTURE_DIR = path.join(__dirname, "fixtures", "content");

/** Remove everything the test users created: evaluations, submissions, uploads. */
export async function cleanTestUserData() {
  const db = adminDb();
  for (const email of Object.values(TEST_EMAILS)) {
    const id = await profileId(email);
    if (!id) continue;
    const { data: subs } = await db.from("submissions").select("id").eq("user_id", id);
    const ids = (subs ?? []).map((s) => s.id);
    if (ids.length) {
      await db.from("evaluations").delete().in("submission_id", ids);
      const { error } = await db.from("submissions").delete().in("id", ids);
      if (error) throw new Error(`clean submissions: ${error.message}`);
    }
    const bucket = db.storage.from("submissions");
    const { data: folders } = await bucket.list(id);
    for (const folder of folders ?? []) {
      const { data: files } = await bucket.list(`${id}/${folder.name}`);
      const paths = (files ?? []).map((f) => `${id}/${folder.name}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
    // Test users never appear on the real leaderboard unless a test turns it on.
    await db.from("profiles").update({ show_on_leaderboard: false }).eq("id", id);
  }
}

export async function installFixtures() {
  const { content, errors } = loadAndValidate(FIXTURE_DIR);
  if (errors.length) throw new Error(`E2E fixtures invalid: ${JSON.stringify(errors)}`);
  const db = adminDb();
  const { error: catErr } = await db.from("categories").upsert(content.categories.map(toCategoryRow));
  if (catErr) throw new Error(`fixture categories: ${catErr.message}`);
  for (const ch of content.challenges) {
    const { challenge, key } = toChallengeRows(ch, content.categories);
    const { error } = await db.from("challenges").upsert({
      ...challenge,
      questions: challenge.questions as never,
      submission_spec: challenge.submission_spec as never,
      rubric: challenge.rubric as never,
      version: 1,
    });
    if (error) throw new Error(`fixture challenge ${challenge.slug}: ${error.message}`);
    const { error: kErr } = await db.from("challenge_keys").upsert(key);
    if (kErr) throw new Error(`fixture key ${challenge.slug}: ${kErr.message}`);
  }
}

export async function removeFixtures() {
  const { content } = loadAndValidate(FIXTURE_DIR);
  const db = adminDb();
  const slugs = content.challenges.map((c) => c.data.slug);
  await db.from("challenge_keys").delete().in("challenge_slug", slugs);
  const { error } = await db.from("challenges").delete().in("slug", slugs);
  if (error) {
    // Someone else submitted to a fixture: never delete then — archive instead.
    await db.from("challenges").update({ status: "archived" }).in("slug", slugs);
    await db.from("categories").update({ archived: true }).in("slug", content.categories.map((c) => c.slug));
    return;
  }
  await db.from("categories").delete().in("slug", content.categories.map((c) => c.slug));
}
