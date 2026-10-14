/**
 * Database health + security check.
 *  1. Expected public tables exist.
 *  2. RLS is enabled on every public table.
 *  3. Neither anon nor a signed-in user can read challenge_keys / admin_allowlist
 *     (tested with a real sentinel row and a real temporary user, both removed afterwards).
 *  4. Users can't write acknowledgements themselves and only see their own; the group
 *     leaderboard function is callable.
 *  5. allowed_email_domains matches ALLOWED_EMAIL_DOMAINS, and the signup trigger accepts
 *     those domains and rejects others.
 *  6. Drafts (submission_drafts): a user reads and writes only their own rows, not even an admin sees or edits
 *     someone else's, anon sees none, and the shape limits hold.
 *  7. set_challenge_setting writes the value + one audit row (none for a no-op); users can't
 *     call it or read the audit log.
 *  8. Testers: only a tester sees a draft, only when their track (and its category's) can see it, never an archived
 *     one; users can't flag themselves; set_user_tester audits; test attempts are numbered apart from the 3-attempt
 *     limit, hidden from their owner once the challenge is published, and left out of the leaderboard; feedback is
 *     admin-only.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { allowedEmailDomains } from "../src/lib/auth/domain";
import type { Database } from "../src/lib/database.types";
import { requireEnv } from "./lib/env";
import { runSql } from "./lib/management-api";
import { adminClient, anonClient } from "./lib/supabase";

const EXPECTED_TABLES = [
  "admin_allowlist",
  "allowed_email_domains",
  "profiles",
  "categories",
  "challenges",
  "challenge_keys",
  "submissions",
  "evaluations",
  "acknowledgements",
  "challenge_settings_audit",
  "submission_drafts",
  "profile_flag_audit",
  "challenge_feedback",
];
const SENTINEL_CATEGORY = "zz-check-db";
const SENTINEL_CHALLENGE = "zz-check-db-challenge";

let failures = 0;
function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string) {
  failures++;
  console.log(`  ✗ ${msg}`);
}

async function checkTablesAndRls() {
  const rows = await runSql<{ relname: string; relrowsecurity: boolean }>(`
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')`);
  const names = new Set(rows.map((r) => r.relname));
  for (const t of EXPECTED_TABLES) {
    if (names.has(t)) pass(`table ${t} exists`);
    else fail(`table ${t} is missing`);
  }
  for (const r of rows) {
    if (r.relrowsecurity) pass(`RLS enabled on ${r.relname}`);
    else fail(`RLS DISABLED on ${r.relname}`);
  }
}

type Client = ReturnType<typeof anonClient>;

type PrivateTable =
  | "challenge_keys"
  | "admin_allowlist"
  | "allowed_email_domains"
  | "challenge_settings_audit"
  | "profile_flag_audit"
  | "challenge_feedback";

async function expectNoRows(client: Client, table: PrivateTable, who: string) {
  const { data, error } = await client.from(table).select("*");
  if (error) pass(`${who} cannot read ${table} (${error.code ?? error.message})`);
  else if (!data || data.length === 0) pass(`${who} reads 0 rows from ${table}`);
  else fail(`${who} CAN READ ${table}: ${data.length} row(s)`);
}

async function main() {
  console.log("Tables & RLS");
  await checkTablesAndRls();

  const admin = adminClient();
  const domains = allowedEmailDomains();

  console.log("Allowed email domains");
  const { data: domainRows, error: domainErr } = await admin.from("allowed_email_domains").select("domain");
  if (domainErr) throw new Error(`allowed_email_domains: ${domainErr.message}`);
  const inDb = (domainRows ?? []).map((r) => r.domain).sort();
  if (JSON.stringify(inDb) === JSON.stringify([...domains].sort())) pass(`DB matches ALLOWED_EMAIL_DOMAINS (${inDb.join(", ")})`);
  else fail(`DB has [${inDb.join(", ")}], ALLOWED_EMAIL_DOMAINS is [${domains.join(", ")}] — run npm run seed:domains`);

  const email = `check-db-${randomBytes(4).toString("hex")}@${domains[0]}`;
  const password = randomBytes(18).toString("base64url");
  let userId: string | undefined;

  try {
    // Sentinel data so "0 rows" really means "blocked", not "empty table".
    const { error: catErr } = await admin.from("categories").upsert({
      slug: SENTINEL_CATEGORY, title: "check-db sentinel", audiences: ["all"], archived: false,
    });
    if (catErr) throw new Error(`sentinel category: ${catErr.message}`);
    const { error: chErr } = await admin.from("challenges").upsert({
      slug: SENTINEL_CHALLENGE, category_slug: SENTINEL_CATEGORY, title: "sentinel",
      body_md: "sentinel", type: "quiz", audiences: ["all"], difficulty: 1, points: 1,
      content_hash: "sentinel", status: "published",
    });
    if (chErr) throw new Error(`sentinel challenge: ${chErr.message}`);
    const { error: keyErr } = await admin.from("challenge_keys").upsert({
      challenge_slug: SENTINEL_CHALLENGE, answer_key: { q1: "secret" }, grader_notes: "secret",
    });
    if (keyErr) throw new Error(`sentinel key: ${keyErr.message}`);

    console.log("Anonymous client");
    await expectNoRows(anonClient(), "challenge_keys", "anon");
    await expectNoRows(anonClient(), "admin_allowlist", "anon");
    await expectNoRows(anonClient(), "allowed_email_domains", "anon");
    const { data: anonChallenges } = await anonClient().from("challenges").select("slug");
    if (!anonChallenges?.length) pass("anon reads 0 challenges");
    else fail(`anon CAN READ challenges (${anonChallenges.length})`);

    console.log("Authenticated client");
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (createErr || !created.user) throw new Error(`temp user (@${domains[0]}): ${createErr?.message}`);
    userId = created.user.id;
    pass(`@${domains[0]} email is accepted at signup`);

    const authed = createClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInErr } = await authed.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`temp user sign-in: ${signInErr.message}`);

    await expectNoRows(authed, "challenge_keys", "authenticated user");
    await expectNoRows(authed, "admin_allowlist", "authenticated user");
    await expectNoRows(authed, "allowed_email_domains", "authenticated user");
    const { data: visible } = await authed.from("challenges").select("slug").eq("slug", SENTINEL_CHALLENGE);
    if (visible?.length === 1) pass("authenticated user can read the published challenge (policy works)");
    else fail("authenticated user cannot read a published challenge");
    const { error: setAdminErr } = await authed.from("profiles").update({ is_admin: true }).eq("id", userId);
    const { data: me } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
    if (setAdminErr && me?.is_admin === false) pass("user cannot make themselves admin");
    else fail("user COULD update is_admin on their profile");

    console.log("Acknowledgements & leaderboard");
    const { error: ackWriteErr } = await authed
      .from("acknowledgements")
      .insert({ user_id: userId, challenge_slug: SENTINEL_CHALLENGE, challenge_version: 1 });
    if (ackWriteErr) pass(`user cannot write acknowledgements directly (${ackWriteErr.code ?? ackWriteErr.message})`);
    else fail("user COULD insert their own acknowledgement");
    // Someone else's acknowledgement (written by the service role) must stay invisible.
    const { data: others } = await admin.from("profiles").select("id").neq("id", userId).limit(1);
    const otherId = others?.[0]?.id;
    if (otherId) {
      const { error: seedAckErr } = await admin
        .from("acknowledgements")
        .insert({ user_id: otherId, challenge_slug: SENTINEL_CHALLENGE, challenge_version: 1 });
      if (seedAckErr) throw new Error(`sentinel acknowledgement: ${seedAckErr.message}`);
      const { data: seen } = await authed.from("acknowledgements").select("user_id");
      if (!seen?.length) pass("user cannot read other users' acknowledgements");
      else fail(`user CAN READ other users' acknowledgements (${seen.length})`);
    }
    const { error: lbErr } = await authed.rpc("get_leaderboard", { p_tracks: ["designer", "motion_designer"] });
    if (!lbErr) pass("signed-in user can call get_leaderboard(track[])");
    else fail(`get_leaderboard(track[]) failed: ${lbErr.message}`);

    console.log("Submission drafts");
    const draft = { challenge_slug: SENTINEL_CHALLENGE, challenge_version: 1, answers: { q1: "a" }, current_step: 2 };
    const { error: ownDraftErr } = await authed.from("submission_drafts").upsert({ ...draft, user_id: userId });
    const { data: ownDrafts } = await authed.from("submission_drafts").select("current_step");
    if (!ownDraftErr && ownDrafts?.length === 1 && ownDrafts[0].current_step === 2) pass("user can write and read their own draft");
    else fail(`user cannot save their own draft: ${ownDraftErr?.message ?? JSON.stringify(ownDrafts)}`);
    const { data: anonDrafts } = await anonClient().from("submission_drafts").select("user_id");
    if (!anonDrafts?.length) pass("anon reads 0 drafts");
    else fail(`anon CAN READ drafts (${anonDrafts.length})`);
    const { error: bigErr } = await authed
      .from("submission_drafts")
      .update({ image_paths: Array.from({ length: 11 }, (_, i) => `p${i}`) })
      .eq("user_id", userId);
    if (bigErr) pass(`draft shape limits hold (${bigErr.code ?? bigErr.message})`);
    else fail("a draft with 11 screenshots was ACCEPTED");
    if (otherId) {
      const { error: seedDraftErr } = await admin.from("submission_drafts").insert({ ...draft, user_id: otherId });
      if (seedDraftErr) throw new Error(`sentinel draft: ${seedDraftErr.message}`);
      const { error: forgeErr } = await authed.from("submission_drafts").upsert({ ...draft, user_id: otherId, current_step: 9 });
      const { data: forged } = await admin.from("submission_drafts").select("current_step").eq("user_id", otherId).single();
      if (forgeErr && forged?.current_step === 2) pass("user cannot write another user's draft");
      else fail("user COULD write another user's draft");
      // Not even an admin: promote the temp user, then look for the other user's row.
      await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
      const { data: adminSees } = await authed.from("submission_drafts").select("user_id");
      const { error: adminEditErr } = await authed.from("submission_drafts").update({ current_step: 9 }).eq("user_id", otherId);
      const { data: afterEdit } = await admin.from("submission_drafts").select("current_step").eq("user_id", otherId).single();
      await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
      if (adminSees?.every((r) => r.user_id === userId) && !adminEditErr && afterEdit?.current_step === 2) {
        pass("an admin cannot read or edit another user's draft");
      } else {
        fail(`an admin COULD reach another user's draft: ${JSON.stringify({ adminSees, adminEditErr, afterEdit })}`);
      }
    }

    console.log("Challenge settings & audit log");
    const set = (p_field: string, p_value: unknown) =>
      admin.rpc("set_challenge_setting", {
        p_slug: SENTINEL_CHALLENGE, p_field, p_value: p_value as never, p_source: "admin", p_actor: userId,
      });
    const changed = await set("required_for", ["designer"]);
    const unchanged = await set("required_for", ["designer"]);
    const { data: auditRows } = await admin
      .from("challenge_settings_audit")
      .select("field,old_value,new_value,changed_by")
      .eq("challenge_slug", SENTINEL_CHALLENGE);
    const { data: after } = await admin.from("challenges").select("required_for").eq("slug", SENTINEL_CHALLENGE).single();
    if (changed.data === true && unchanged.data === false && after?.required_for.join() === "designer" && auditRows?.length === 1 &&
        JSON.stringify(auditRows[0].old_value) === "[]" && auditRows[0].changed_by === userId) {
      pass("set_challenge_setting updates the challenge and writes one audit row (none for a no-op)");
    } else {
      fail(`set_challenge_setting: ${changed.error?.message ?? unchanged.error?.message ?? JSON.stringify({ after, auditRows })}`);
    }
    const badStatus = await set("status", "live");
    if (badStatus.error) pass("set_challenge_setting rejects an invalid status (column check)");
    else fail("set_challenge_setting ACCEPTED status 'live'");
    await expectNoRows(authed, "challenge_settings_audit", "authenticated user");
    const { error: userRpcErr } = await authed.rpc("set_challenge_setting", {
      p_slug: SENTINEL_CHALLENGE, p_field: "status", p_value: "draft", p_source: "admin", p_actor: userId,
    });
    const { data: stillPublished } = await admin.from("challenges").select("status").eq("slug", SENTINEL_CHALLENGE).single();
    if (userRpcErr && stillPublished?.status === "published") pass(`user cannot call set_challenge_setting (${userRpcErr.code ?? userRpcErr.message})`);
    else fail("user COULD call set_challenge_setting");

    console.log("Testers");
    const seesSentinel = async () => ((await authed.from("challenges").select("slug").eq("slug", SENTINEL_CHALLENGE)).data ?? []).length === 1;
    const setStatus = (status: string) => admin.from("challenges").update({ status }).eq("slug", SENTINEL_CHALLENGE);
    await admin.from("profiles").update({ track: "designer", is_admin: false, is_tester: false, show_on_leaderboard: true }).eq("id", userId);
    await setStatus("draft");
    if (!(await seesSentinel())) pass("a user who is not a tester cannot see a draft challenge");
    else fail("a non-tester CAN SEE a draft challenge");
    const { error: selfTesterErr } = await authed.from("profiles").update({ is_tester: true }).eq("id", userId);
    const { data: stillNot } = await admin.from("profiles").select("is_tester").eq("id", userId).single();
    if (selfTesterErr && stillNot?.is_tester === false) pass("user cannot make themselves a tester");
    else fail("user COULD set is_tester on their profile");
    const { error: userTesterRpc } = await authed.rpc("set_user_tester", { p_user: userId, p_value: true, p_actor: userId });
    if (userTesterRpc) pass(`user cannot call set_user_tester (${userTesterRpc.code ?? userTesterRpc.message})`);
    else fail("user COULD call set_user_tester");
    const notAdmin = await admin.rpc("set_user_tester", { p_user: userId, p_value: true, p_actor: userId });
    if (notAdmin.error) pass("set_user_tester refuses an actor who is not an admin");
    else fail("set_user_tester ACCEPTED a non-admin actor");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const flagged = await admin.rpc("set_user_tester", { p_user: userId, p_value: true, p_actor: userId });
    const flaggedAgain = await admin.rpc("set_user_tester", { p_user: userId, p_value: true, p_actor: userId });
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: flagAudit } = await admin.from("profile_flag_audit").select("old_value,new_value,changed_by").eq("profile_id", userId);
    if (flagged.data === true && flaggedAgain.data === false && flagAudit?.length === 1 && flagAudit[0].old_value === false &&
        flagAudit[0].new_value === true && flagAudit[0].changed_by === userId) {
      pass("set_user_tester sets the flag and writes one audit row (none for a no-op)");
    } else {
      fail(`set_user_tester: ${flagged.error?.message ?? JSON.stringify({ flagged: flagged.data, flaggedAgain: flaggedAgain.data, flagAudit })}`);
    }
    await expectNoRows(authed, "profile_flag_audit", "authenticated user");
    await expectNoRows(authed, "challenge_feedback", "authenticated user");

    if (await seesSentinel()) pass("a tester sees a draft challenge their track can see");
    else fail("a tester CANNOT see a draft their track can see");
    await admin.from("challenges").update({ audiences: ["strategist"] }).eq("slug", SENTINEL_CHALLENGE);
    if (!(await seesSentinel())) pass("a tester does not see a draft their track can't see");
    else fail("a tester SEES a draft aimed at another track");
    await admin.from("challenges").update({ audiences: ["all"] }).eq("slug", SENTINEL_CHALLENGE);
    await admin.from("categories").update({ audiences: ["strategist"] }).eq("slug", SENTINEL_CATEGORY);
    if (!(await seesSentinel())) pass("a tester does not see a draft in a category their track can't see");
    else fail("a tester SEES a draft in a category aimed at another track");
    await admin.from("categories").update({ audiences: ["all"], archived: true }).eq("slug", SENTINEL_CATEGORY);
    if (!(await seesSentinel())) pass("a tester does not see a draft in an archived category");
    else fail("a tester SEES a draft in an archived category");
    await admin.from("categories").update({ archived: false }).eq("slug", SENTINEL_CATEGORY);
    await setStatus("archived");
    if (!(await seesSentinel())) pass("a tester does not see an archived challenge");
    else fail("a tester SEES an archived challenge");
    await setStatus("draft");

    // Test attempts: numbered apart from the 3-attempt limit, hidden from their owner after publishing, never on the leaderboard.
    const attempt = (n: number, is_test: boolean) => ({
      user_id: userId!, challenge_slug: SENTINEL_CHALLENGE, challenge_version: 1, attempt: n, is_test,
      status: "published" as const, auto_score: 1, final_score: 1, max_score: 1,
    });
    const testRows = await admin.from("submissions").insert([attempt(1, true), attempt(2, true), attempt(3, true), attempt(4, true)]);
    const realRows = await admin.from("submissions").insert([attempt(1, false), attempt(2, false), attempt(3, false)]);
    const fourthReal = await admin.from("submissions").insert(attempt(4, false));
    if (!testRows.error && !realRows.error && fourthReal.error) pass("test attempts go past 3 and are numbered apart; a 4th real attempt is refused");
    else fail(`attempt numbering: ${JSON.stringify({ test: testRows.error?.message, real: realRows.error?.message, fourthReal: fourthReal.error?.message })}`);
    const readTests = async () => ((await authed.from("submissions").select("id").eq("is_test", true)).data ?? []).length;
    if ((await readTests()) === 4) pass("the owner reads their test attempts while the challenge is a draft");
    else fail("the owner cannot read their test attempts on a draft");
    await setStatus("published");
    if ((await readTests()) === 0) pass("after publishing, the owner no longer sees their test attempts");
    else fail("the owner STILL SEES test attempts after the challenge was published");
    const { data: adminTests } = await admin.from("submissions").select("id").eq("is_test", true).eq("challenge_slug", SENTINEL_CHALLENGE);
    if (adminTests?.length === 4) pass("test attempts stay in the table for admins");
    else fail("test attempts went missing");
    const { data: board } = await authed.rpc("get_leaderboard", { p_tracks: ["designer"] });
    const mine = board?.find((r) => r.user_id === userId);
    if (mine && Number(mine.total_score) === 1 && mine.completed === 1) pass("the leaderboard counts the real attempts and not the test ones");
    else fail(`leaderboard row: ${JSON.stringify(mine)}`);
    await admin.from("submissions").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    const feedbackWrite = await authed.from("challenge_feedback").insert({ challenge_slug: SENTINEL_CHALLENGE, user_id: userId, body: "hi" });
    if (feedbackWrite.error) pass(`user cannot write feedback directly (${feedbackWrite.error.code ?? feedbackWrite.error.message})`);
    else fail("user COULD insert feedback directly");

    console.log("Signup trigger");
    const { data: outsider, error: outsiderErr } = await admin.auth.admin.createUser({
      email: `check-db-${randomBytes(4).toString("hex")}@example.com`, password, email_confirm: true,
    });
    if (outsiderErr) pass("email from a non-allowed domain is rejected at signup");
    else {
      fail("email from a non-allowed domain was ACCEPTED at signup");
      if (outsider.user) await admin.auth.admin.deleteUser(outsider.user.id);
    }
  } finally {
    await admin.from("challenge_settings_audit").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("challenge_feedback").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("submissions").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    if (userId) await admin.auth.admin.deleteUser(userId);
    await admin.from("acknowledgements").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("submission_drafts").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("challenge_keys").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("challenges").delete().eq("slug", SENTINEL_CHALLENGE);
    await admin.from("categories").delete().eq("slug", SENTINEL_CATEGORY);
  }

  if (failures > 0) {
    console.error(`\ncheck-db: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ncheck-db: all checks passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
