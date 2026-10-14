import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { loadAndValidate } from "../../src/lib/content";
import { toCategoryRow, toChallengeRows } from "../../src/lib/content/transform";
import { testUser } from "../../src/lib/auth/test-login";

type Db = SupabaseClient<Database>;

/** Same addresses the app's test login uses (first ALLOWED_EMAIL_DOMAINS domain). */
export const TEST_EMAILS = {
  get strategist() {
    return testUser("strategist").email;
  },
  get designer() {
    return testUser("designer").email;
  },
  get admin() {
    return testUser("admin").email;
  },
};

const FIXTURE_DIR = path.join(__dirname, "..", "..", "e2e", "fixtures", "content");

export async function profileIdFor(db: Db, email: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

/** Remove everything the test users created: evaluations, submissions, drafts, acknowledgements, uploads. */
export async function cleanTestUserData(db: Db) {
  for (const email of Object.values(TEST_EMAILS)) {
    const id = await profileIdFor(db, email);
    if (!id) continue;
    const { data: subs } = await db.from("submissions").select("id").eq("user_id", id);
    const ids = (subs ?? []).map((s) => s.id);
    if (ids.length) {
      await db.from("evaluations").delete().in("submission_id", ids);
      const { error } = await db.from("submissions").delete().in("id", ids);
      if (error) throw new Error(`clean submissions: ${error.message}`);
    }
    const { error: draftErr } = await db.from("submission_drafts").delete().eq("user_id", id);
    if (draftErr) throw new Error(`clean drafts: ${draftErr.message}`);
    const { error: ackErr } = await db.from("acknowledgements").delete().eq("user_id", id);
    if (ackErr) throw new Error(`clean acknowledgements: ${ackErr.message}`);
    const bucket = db.storage.from("submissions");
    const { data: folders } = await bucket.list(id);
    for (const folder of folders ?? []) {
      const { data: files } = await bucket.list(`${id}/${folder.name}`);
      const paths = (files ?? []).map((f) => `${id}/${folder.name}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
    await db.from("profiles").update({ show_on_leaderboard: false }).eq("id", id);
  }
}

/** Install the [E2E] fixture category + challenges (published) from e2e/fixtures/content (or another content folder). */
export async function installFixtures(db: Db, dir: string = FIXTURE_DIR) {
  const { content, errors } = loadAndValidate(dir);
  if (errors.length) throw new Error(`Test fixtures invalid: ${JSON.stringify(errors)}`);
  const { error: catErr } = await db.from("categories").upsert(content.categories.map(toCategoryRow));
  if (catErr) throw new Error(`fixture categories: ${catErr.message}`);
  for (const ch of content.challenges) {
    const { challenge, settings, key } = toChallengeRows(ch, content.categories);
    const { error } = await db.from("challenges").upsert({
      ...challenge,
      ...settings,
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

/** Remove some fixture challenges (and what hangs off them) but leave the category alone. */
export async function removeChallenges(db: Db, slugs: string[]) {
  await db.from("challenge_keys").delete().in("challenge_slug", slugs);
  await db.from("acknowledgements").delete().in("challenge_slug", slugs);
  await db.from("submission_drafts").delete().in("challenge_slug", slugs);
  const { error } = await db.from("challenges").delete().in("slug", slugs);
  if (error) await db.from("challenges").update({ status: "archived" }).in("slug", slugs);
}

export async function removeFixtures(db: Db) {
  const { content } = loadAndValidate(FIXTURE_DIR);
  const slugs = content.challenges.map((c) => c.data.slug);
  const catSlugs = content.categories.map((c) => c.slug);
  await db.from("challenge_keys").delete().in("challenge_slug", slugs);
  await db.from("acknowledgements").delete().in("challenge_slug", slugs);
  await db.from("submission_drafts").delete().in("challenge_slug", slugs);
  const { error } = await db.from("challenges").delete().in("slug", slugs);
  if (error) {
    // Something else references a fixture: never force-delete — archive instead.
    await db.from("challenges").update({ status: "archived" }).in("slug", slugs);
    await db.from("categories").update({ archived: true }).in("slug", catSlugs);
    return;
  }
  await db.from("categories").delete().in("slug", catSlugs);
}

/** Make sure a test user exists (created by a magic-link generation) and return its id. */
export async function ensureTestUser(db: Db, email: string, fullName: string): Promise<string> {
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { full_name: fullName, test_user: true } },
  });
  if (error || !data.user) throw new Error(`test user ${email}: ${error?.message}`);
  return data.user.id;
}
