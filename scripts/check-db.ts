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
 *  9. Paths: drafts only for testers whose track can see them; users can't write paths; set_path_status audits and can
 *     publish the milestones with the path; import_submission needs an admin actor and a published path, numbers the
 *     attempt, refuses past full points and is audited; undo_import removes it; users can't call either.
 * 10. Leads: only a lead (or admin) can call the team_* functions, which return status/score columns only and no test
 *     attempts; users can't flag themselves; set_user_lead needs an admin actor and audits; RLS on submissions and
 *     profiles is unchanged for a lead.
 * 11. Academy: users see published resources only (editors and admins see drafts too), never the quiz keys, and can't
 *     write resources, completions or attempts; users can't flag themselves editors; set_user_academy_editor needs an
 *     admin actor and audits; team_academy() is for leads and admins and returns completion columns only; nothing is
 *     published without 5 questions; the `academy` bucket is public and users can't upload to it.
 *     Review edits: users can't call edit_submission or adjust_submission_review or read submission_review_audit;
 *     edit_submission refuses a reviewed submission.
 * 12. Staff titles: signed-in users read them, anon doesn't, nobody writes them directly; set_staff_title,
 *     rename_staff_email and set_user_track need an admin actor (seed excepted), are audited in staff_audit (none for a
 *     no-op), and users can't call them or read the audit.
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
  "paths",
  "path_settings_audit",
  "submission_import_audit",
  "submission_review_audit",
  "staff_titles",
  "staff_audit",
  "academy_resources",
  "academy_quiz_keys",
  "academy_completions",
  "academy_quiz_attempts",
];
const SENTINEL_CATEGORY = "zz-check-db";
const SENTINEL_CHALLENGE = "zz-check-db-challenge";
const SENTINEL_PATH = "zz-check-db-path";
const ACADEMY_SENTINEL = "zz-check-db academy";
const ACADEMY_SENTINEL_URL = "https://example.com/zz-check-db-academy";

const SENTINEL_TITLE_EMAIL = `zz-check-db-${randomBytes(4).toString("hex")}@example.com`;
const SENTINEL_TITLE_RENAMED = SENTINEL_TITLE_EMAIL.replace("zz-check-db-", "zz-check-db-renamed-");

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
  | "academy_quiz_keys"
  | "academy_resources"
  | "admin_allowlist"
  | "allowed_email_domains"
  | "challenge_settings_audit"
  | "profile_flag_audit"
  | "challenge_feedback"
  | "path_settings_audit"
  | "submission_import_audit"
  | "submission_review_audit"
  | "staff_titles"
  | "staff_audit";

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

    console.log("Leads");
    // The temp user has 3 real and 4 test attempts on the published sentinel here; not an admin, not a lead.
    // Only the check user's rows: the full results can pass the API's 1,000-row page.
    const checkUserId = userId; // a const keeps its narrowing inside the closure
    const teamCalls = () =>
      Promise.all([authed.rpc("team_members"), authed.rpc("team_submissions").eq("user_id", checkUserId), authed.rpc("team_acknowledgements").eq("user_id", checkUserId)]);
    const refused = (await teamCalls()).every((r) => r.error?.code === "42501");
    if (refused) pass("a user who is neither lead nor admin cannot call the team_* functions (42501)");
    else fail("a non-lead COULD call a team_* function");
    const { error: selfLeadErr } = await authed.from("profiles").update({ is_lead: true }).eq("id", userId);
    const { data: notLead } = await admin.from("profiles").select("is_lead").eq("id", userId).single();
    if (selfLeadErr && notLead?.is_lead === false) pass("user cannot make themselves a lead");
    else fail("user COULD set is_lead on their profile");
    const { error: userLeadRpc } = await authed.rpc("set_user_lead", { p_user: userId, p_value: true, p_actor: userId });
    if (userLeadRpc) pass(`user cannot call set_user_lead (${userLeadRpc.code ?? userLeadRpc.message})`);
    else fail("user COULD call set_user_lead");
    const leadNotAdmin = await admin.rpc("set_user_lead", { p_user: userId, p_value: true, p_actor: userId });
    if (leadNotAdmin.error) pass("set_user_lead refuses an actor who is not an admin");
    else fail("set_user_lead ACCEPTED a non-admin actor");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const leadOn = await admin.rpc("set_user_lead", { p_user: userId, p_value: true, p_actor: userId });
    const leadAgain = await admin.rpc("set_user_lead", { p_user: userId, p_value: true, p_actor: userId });
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: leadAudit } = await admin
      .from("profile_flag_audit")
      .select("old_value,new_value,changed_by")
      .eq("profile_id", userId)
      .eq("field", "is_lead");
    if (leadOn.data === true && leadAgain.data === false && leadAudit?.length === 1 && leadAudit[0].old_value === false &&
        leadAudit[0].new_value === true && leadAudit[0].changed_by === userId) {
      pass("set_user_lead sets the flag and writes one audit row (none for a no-op)");
    } else {
      fail(`set_user_lead: ${leadOn.error?.message ?? JSON.stringify({ leadOn: leadOn.data, leadAgain: leadAgain.data, leadAudit })}`);
    }
    const [members, teamSubs, teamAcks] = await teamCalls();
    const myTeamSubs = (teamSubs.data ?? []).filter((r) => r.user_id === userId && r.challenge_slug === SENTINEL_CHALLENGE);
    if (!members.error && !teamSubs.error && !teamAcks.error && members.data?.some((m) => m.id === userId) && myTeamSubs.length === 3) {
      pass("a lead can call the team_* functions, and team_submissions leaves out test attempts");
    } else {
      fail(`a lead's team_* calls: ${members.error?.message ?? teamSubs.error?.message ?? teamAcks.error?.message ?? JSON.stringify({ myTeamSubs })}`);
    }
    const memberKeys = Object.keys(members.data?.[0] ?? {}).sort().join();
    const subKeys = Object.keys(teamSubs.data?.[0] ?? {}).sort().join();
    if (memberKeys === "avatar_url,full_name,id,track" && subKeys === "attempt,challenge_slug,final_score,max_score,published_at,status,user_id") {
      pass("the team_* functions return only status and score columns (no email, answers or feedback)");
    } else {
      fail(`team_* columns: ${JSON.stringify({ memberKeys, subKeys })}`);
    }
    const { data: leadSubs } = await authed.from("submissions").select("user_id");
    const { data: leadProfiles } = await authed.from("profiles").select("id");
    if (leadSubs?.every((r) => r.user_id === userId) && leadProfiles?.every((r) => r.id === userId)) {
      pass("a lead still reads only their own submissions and profile directly (RLS unchanged)");
    } else {
      fail("a lead CAN READ other people's submissions or profiles directly");
    }
    await admin.from("profiles").update({ is_lead: false }).eq("id", userId);
    if ((await teamCalls()).every((r) => r.error?.code === "42501")) pass("with the lead flag off again, the team_* functions refuse");
    else fail("team_* functions STILL ANSWER after the lead flag was turned off");

    await admin.from("submissions").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    const feedbackWrite = await authed.from("challenge_feedback").insert({ challenge_slug: SENTINEL_CHALLENGE, user_id: userId, body: "hi" });
    if (feedbackWrite.error) pass(`user cannot write feedback directly (${feedbackWrite.error.code ?? feedbackWrite.error.message})`);
    else fail("user COULD insert feedback directly");

    console.log("Paths & imported progress");
    // The temp user is a designer and a tester here, not an admin; the sentinel challenge is published, worth 1 point.
    const { error: pathErr } = await admin.from("paths").upsert({
      slug: SENTINEL_PATH, category_slug: SENTINEL_CATEGORY, title: "sentinel path", summary: "sentinel",
      audiences: ["all"], milestones: [SENTINEL_CHALLENGE, SENTINEL_CHALLENGE], status: "draft",
    });
    if (pathErr) throw new Error(`sentinel path: ${pathErr.message}`);
    await admin.from("challenges").update({ path_slug: SENTINEL_PATH }).eq("slug", SENTINEL_CHALLENGE);
    const seesPath = async () => ((await authed.from("paths").select("slug").eq("slug", SENTINEL_PATH)).data ?? []).length === 1;
    if (await seesPath()) pass("a tester sees a draft path their track can see");
    else fail("a tester CANNOT see a draft path their track can see");
    await admin.from("paths").update({ audiences: ["strategist"] }).eq("slug", SENTINEL_PATH);
    if (!(await seesPath())) pass("a tester does not see a draft path their track can't see");
    else fail("a tester SEES a draft path aimed at another track");
    await admin.from("paths").update({ audiences: ["all"] }).eq("slug", SENTINEL_PATH);
    await admin.from("profiles").update({ is_tester: false }).eq("id", userId);
    if (!(await seesPath())) pass("a user who is not a tester cannot see a draft path");
    else fail("a non-tester CAN SEE a draft path");
    const { data: anonPaths } = await anonClient().from("paths").select("slug");
    if (!anonPaths?.length) pass("anon reads 0 paths");
    else fail(`anon CAN READ paths (${anonPaths.length})`);
    const { error: pathWriteErr } = await authed.from("paths").update({ title: "hacked" }).eq("slug", SENTINEL_PATH);
    const { data: pathTitle } = await admin.from("paths").select("title").eq("slug", SENTINEL_PATH).single();
    if (pathTitle?.title === "sentinel path") pass(`user cannot write paths (${pathWriteErr?.code ?? "0 rows"})`);
    else fail("user COULD update a path");

    await setStatus("draft");
    const publishPath = (actor: string | undefined) =>
      admin.rpc("set_path_status", { p_slug: SENTINEL_PATH, p_value: "published", p_source: "admin", p_actor: actor, p_publish_milestones: true });
    const notAdminPublish = await publishPath(userId);
    if (notAdminPublish.error) pass("set_path_status refuses an admin-panel change by a non-admin");
    else fail("set_path_status ACCEPTED a non-admin actor");
    const { error: userPathRpc } = await authed.rpc("set_path_status", { p_slug: SENTINEL_PATH, p_value: "published", p_source: "admin", p_actor: userId });
    if (userPathRpc) pass(`user cannot call set_path_status (${userPathRpc.code ?? userPathRpc.message})`);
    else fail("user COULD call set_path_status");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const published = await publishPath(userId);
    const publishedAgain = await publishPath(userId);
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: pathAudit } = await admin.from("path_settings_audit").select("old_value,new_value,changed_by").eq("path_slug", SENTINEL_PATH);
    const { data: milestoneNow } = await admin.from("challenges").select("status").eq("slug", SENTINEL_CHALLENGE).single();
    const { data: milestoneAudit } = await admin
      .from("challenge_settings_audit").select("new_value").eq("challenge_slug", SENTINEL_CHALLENGE).eq("field", "status");
    if (published.data === true && publishedAgain.data === false && pathAudit?.length === 1 && pathAudit[0].changed_by === userId &&
        milestoneNow?.status === "published" && milestoneAudit?.some((r) => r.new_value === "published")) {
      pass("set_path_status publishes the path and its draft milestones, with audit rows (none for a no-op)");
    } else {
      fail(`set_path_status: ${published.error?.message ?? JSON.stringify({ pathAudit, milestoneNow, milestoneAudit })}`);
    }
    if (await seesPath()) pass("a published path is visible to a signed-in user");
    else fail("a published path is NOT visible");

    // Path required_for / due_at: admin only, audited, no row for a no-op, and the column check refuses "all" + a track.
    const setPathSetting = (field: string, value: unknown, actor: string | undefined) =>
      admin.rpc("set_path_setting", { p_slug: SENTINEL_PATH, p_field: field, p_value: value as never, p_source: "admin", p_actor: actor });
    if ((await setPathSetting("required_for", ["designer"], userId)).error) pass("set_path_setting refuses an admin-panel change by a non-admin");
    else fail("set_path_setting ACCEPTED a non-admin actor");
    const { error: userSettingRpc } = await authed.rpc("set_path_setting", {
      p_slug: SENTINEL_PATH, p_field: "required_for", p_value: ["designer"], p_source: "admin", p_actor: userId,
    });
    if (userSettingRpc) pass(`user cannot call set_path_setting (${userSettingRpc.code ?? userSettingRpc.message})`);
    else fail("user COULD call set_path_setting");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const required = await setPathSetting("required_for", ["designer"], userId);
    const requiredAgain = await setPathSetting("required_for", ["designer"], userId);
    const due = await setPathSetting("due_at", "2026-12-01T17:00:00Z", userId);
    const badRequired = await setPathSetting("required_for", ["all", "designer"], userId);
    const unknownField = await setPathSetting("status", "archived", userId);
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: pathNow } = await admin.from("paths").select("required_for,due_at").eq("slug", SENTINEL_PATH).single();
    const { data: settingAudit } = await admin
      .from("path_settings_audit").select("field,new_value,changed_by").eq("path_slug", SENTINEL_PATH).in("field", ["required_for", "due_at"]);
    if (required.data === true && requiredAgain.data === false && due.data === true && badRequired.error && unknownField.error &&
        pathNow?.required_for.join() === "designer" && pathNow.due_at !== null &&
        settingAudit?.length === 2 && settingAudit.every((r) => r.changed_by === userId)) {
      pass("set_path_setting sets required_for and due_at with audit rows (none for a no-op), refuses bad values and fields");
    } else {
      fail(`set_path_setting: ${JSON.stringify({ required, requiredAgain, due, badRequired: badRequired.error?.message, unknownField: unknownField.error?.message, pathNow, settingAudit })}`);
    }

    const importAs = (actor: string, score = 1) =>
      admin.rpc("import_submission", {
        p_user: userId!, p_challenge: SENTINEL_CHALLENGE, p_status: "published", p_score: score,
        p_feedback: "Completed before UXDA Learn", p_source: "admin", p_actor: actor,
      });
    const { error: userImportRpc } = await authed.rpc("import_submission", {
      p_user: userId, p_challenge: SENTINEL_CHALLENGE, p_status: "published", p_score: 1, p_feedback: "", p_source: "admin", p_actor: userId,
    });
    if (userImportRpc) pass(`user cannot call import_submission (${userImportRpc.code ?? userImportRpc.message})`);
    else fail("user COULD call import_submission");
    if ((await importAs(userId)).error) pass("import_submission refuses an actor who is not an admin");
    else fail("import_submission ACCEPTED a non-admin actor");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const tooHigh = await importAs(userId, 2);
    await admin.from("paths").update({ status: "draft" }).eq("slug", SENTINEL_PATH);
    const onDraft = await importAs(userId);
    await admin.from("paths").update({ status: "published" }).eq("slug", SENTINEL_PATH);
    const imported = await importAs(userId);
    const importedAgain = await importAs(userId);
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    if (tooHigh.error && onDraft.error) pass("import_submission refuses a score above the points and a path that isn't published");
    else fail(`import_submission checks: ${JSON.stringify({ tooHigh: tooHigh.data, onDraft: onDraft.data })}`);
    const { data: importedRow } = await admin
      .from("submissions").select("attempt,status,final_score,is_imported,imported_by,feedback").eq("id", imported.data ?? "").maybeSingle();
    if (importedRow?.attempt === 1 && importedRow.status === "published" && Number(importedRow.final_score) === 1 &&
        importedRow.is_imported && importedRow.imported_by === userId && importedRow.feedback === "Completed before UXDA Learn") {
      pass("import_submission records a published, imported attempt with who imported it");
    } else {
      fail(`import_submission: ${imported.error?.message ?? JSON.stringify(importedRow)}`);
    }
    if (importedAgain.error) pass("import_submission refuses a milestone already at full points");
    else fail("import_submission imported a milestone that was already at full points");
    const { data: boardWithImport } = await authed.rpc("get_leaderboard", { p_tracks: ["designer"] });
    if (Number(boardWithImport?.find((r) => r.user_id === userId)?.total_score) === 1) pass("imported points count on the leaderboard");
    else fail("imported points are missing from the leaderboard");
    await expectNoRows(authed, "submission_import_audit", "authenticated user");
    await expectNoRows(authed, "path_settings_audit", "authenticated user");
    await expectNoRows(authed, "submission_review_audit", "authenticated user");
    // Review edits: both go through the service role only (the server actions check the session and admin first).
    const { error: userEditRpc } = await authed.rpc("edit_submission", {
      p_submission: imported.data ?? "", p_user: userId, p_answers: {}, p_image_paths: [], p_figma_url: "",
      p_reflection: "", p_auto_score: 0, p_challenge_version: 1, p_max_score: 1,
    });
    if (userEditRpc) pass(`user cannot call edit_submission (${userEditRpc.code ?? userEditRpc.message})`);
    else fail("user COULD call edit_submission");
    const editImported = await admin.rpc("edit_submission", {
      p_submission: imported.data ?? "", p_user: userId, p_answers: {}, p_image_paths: [], p_figma_url: "",
      p_reflection: "", p_auto_score: 0, p_challenge_version: 1, p_max_score: 1,
    });
    if (editImported.error) pass("edit_submission refuses a reviewed (imported) submission");
    else fail("edit_submission CHANGED a reviewed submission");
    const { error: userAdjustRpc } = await authed.rpc("adjust_submission_review", {
      p_submission: imported.data ?? "", p_score: 0, p_feedback: "", p_actor: userId,
    });
    if (userAdjustRpc) pass(`user cannot call adjust_submission_review (${userAdjustRpc.code ?? userAdjustRpc.message})`);
    else fail("user COULD call adjust_submission_review");
    const { error: userUndoRpc } = await authed.rpc("undo_import", { p_submission: imported.data ?? "", p_source: "admin", p_actor: userId });
    if (userUndoRpc) pass(`user cannot call undo_import (${userUndoRpc.code ?? userUndoRpc.message})`);
    else fail("user COULD call undo_import");
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const undone = await admin.rpc("undo_import", { p_submission: imported.data ?? "", p_source: "admin", p_actor: userId });
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: importAudit } = await admin.from("submission_import_audit").select("action").eq("user_id", userId).order("id");
    const { data: gone } = await admin.from("submissions").select("id").eq("id", imported.data ?? "");
    if (!undone.error && !gone?.length && importAudit?.map((r) => r.action).join() === "import,undo") {
      pass("undo_import removes the imported attempt and both steps are audited");
    } else {
      fail(`undo_import: ${undone.error?.message ?? JSON.stringify({ gone, importAudit })}`);
    }

    console.log("Staff titles & tracks");
    await admin.from("profiles").update({ is_admin: false, track: "designer" }).eq("id", userId);
    const seeded = await admin.rpc("set_staff_title", { p_email: SENTINEL_TITLE_EMAIL, p_title: "Sentinel", p_source: "seed" });
    const seededAgain = await admin.rpc("set_staff_title", { p_email: SENTINEL_TITLE_EMAIL, p_title: "Sentinel", p_source: "seed" });
    const { data: titleAudit } = await admin.from("staff_audit").select("field,old_value,new_value,source").eq("email", SENTINEL_TITLE_EMAIL);
    if (seeded.data === true && seededAgain.data === false && titleAudit?.length === 1 && titleAudit[0].old_value === null &&
        titleAudit[0].new_value === "Sentinel" && titleAudit[0].source === "seed") {
      pass("set_staff_title (seed) writes the title and one audit row (none for a no-op)");
    } else {
      fail(`set_staff_title: ${seeded.error?.message ?? JSON.stringify({ seededAgain: seededAgain.data, titleAudit })}`);
    }
    await expectNoRows(anonClient(), "staff_titles", "anon");
    const { data: titleSeen } = await authed.from("staff_titles").select("job_title").eq("email", SENTINEL_TITLE_EMAIL);
    if (titleSeen?.length === 1) pass("a signed-in user can read job titles");
    else fail("a signed-in user cannot read job titles");
    const { error: titleWriteErr } = await authed.from("staff_titles").update({ job_title: "Hacked" }).eq("email", SENTINEL_TITLE_EMAIL);
    const { error: titleInsertErr } = await authed.from("staff_titles").insert({ email: email.toLowerCase(), job_title: "Hacked" });
    const { data: titleAfter } = await admin.from("staff_titles").select("job_title").eq("email", SENTINEL_TITLE_EMAIL).single();
    if (titleWriteErr && titleInsertErr && titleAfter?.job_title === "Sentinel") pass("a user cannot write job titles directly");
    else fail("a user COULD write job titles");
    const { error: userTitleRpc } = await authed.rpc("set_staff_title", {
      p_email: SENTINEL_TITLE_EMAIL, p_title: "Hacked", p_source: "admin", p_actor: userId,
    });
    if (userTitleRpc) pass(`user cannot call set_staff_title (${userTitleRpc.code ?? userTitleRpc.message})`);
    else fail("user COULD call set_staff_title");
    const titleNotAdmin = await admin.rpc("set_staff_title", {
      p_email: SENTINEL_TITLE_EMAIL, p_title: "Hacked", p_source: "admin", p_actor: userId,
    });
    const renameNotAdmin = await admin.rpc("rename_staff_email", { p_old: SENTINEL_TITLE_EMAIL, p_new: SENTINEL_TITLE_RENAMED, p_actor: userId });
    const trackNotAdmin = await admin.rpc("set_user_track", { p_user: userId, p_track: "management", p_actor: userId });
    if (titleNotAdmin.error && renameNotAdmin.error && trackNotAdmin.error) {
      pass("set_staff_title, rename_staff_email and set_user_track refuse an actor who is not an admin");
    } else {
      fail("a staff function ACCEPTED a non-admin actor");
    }
    const { error: userTrackRpc } = await authed.rpc("set_user_track", { p_user: userId, p_track: "management", p_actor: userId });
    if (userTrackRpc) pass(`user cannot call set_user_track (${userTrackRpc.code ?? userTrackRpc.message})`);
    else fail("user COULD call set_user_track");
    await expectNoRows(authed, "staff_audit", "authenticated user");

    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const renamed = await admin.rpc("rename_staff_email", { p_old: SENTINEL_TITLE_EMAIL, p_new: SENTINEL_TITLE_RENAMED, p_actor: userId });
    const { data: renamedRow } = await admin.from("staff_titles").select("job_title").eq("email", SENTINEL_TITLE_RENAMED);
    const { data: renameAudit } = await admin.from("staff_audit").select("old_value,changed_by").eq("email", SENTINEL_TITLE_RENAMED).eq("field", "email");
    if (renamed.data === true && renamedRow?.length === 1 && renameAudit?.length === 1 && renameAudit[0].old_value === SENTINEL_TITLE_EMAIL &&
        renameAudit[0].changed_by === userId) {
      pass("rename_staff_email moves the title to the fixed email and is audited");
    } else {
      fail(`rename_staff_email: ${renamed.error?.message ?? JSON.stringify({ renamedRow, renameAudit })}`);
    }
    const renameSignedIn = await admin.rpc("rename_staff_email", { p_old: email.toLowerCase(), p_new: SENTINEL_TITLE_EMAIL, p_actor: userId });
    if (renameSignedIn.error) pass("rename_staff_email refuses the email of someone who has signed in");
    else fail("rename_staff_email RENAMED a signed-in person's email");
    const tracked = await admin.rpc("set_user_track", { p_user: userId, p_track: "management", p_actor: userId });
    const trackedAgain = await admin.rpc("set_user_track", { p_user: userId, p_track: "management", p_actor: userId });
    const { data: trackAudit } = await admin.from("staff_audit").select("old_value,new_value,changed_by").eq("field", "track").eq("email", email.toLowerCase());
    const { data: onTrack } = await admin.from("profiles").select("track").eq("id", userId).single();
    if (tracked.data === true && trackedAgain.data === false && onTrack?.track === "management" && trackAudit?.length === 1 &&
        trackAudit[0].old_value === "designer" && trackAudit[0].new_value === "management" && trackAudit[0].changed_by === userId) {
      pass("set_user_track changes the track and writes one audit row (none for a no-op)");
    } else {
      fail(`set_user_track: ${tracked.error?.message ?? JSON.stringify({ trackedAgain: trackedAgain.data, onTrack, trackAudit })}`);
    }
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);

    console.log("Academy");
    await admin.from("profiles").update({ is_admin: false, is_lead: false, is_academy_editor: false }).eq("id", userId);
    const quizQs = Array.from({ length: 5 }, (_, i) => ({ id: `q${i + 1}`, kind: "single", prompt: "?", options: [{ id: "a", label: "x" }, { id: "b", label: "y" }], points: 1 }));
    const { data: acad, error: acadErr } = await admin
      .from("academy_resources")
      .insert([
        { kind: "blog", title: ACADEMY_SENTINEL, url: ACADEMY_SENTINEL_URL, status: "published", questions: quizQs },
        // Same keys in both rows: in a bulk insert a key missing from one row is sent as null, not its default.
        { kind: "book", title: `${ACADEMY_SENTINEL} draft`, url: null, status: "draft", questions: [] },
      ])
      .select("id,status");
    if (acadErr || acad?.length !== 2) throw new Error(`academy sentinels: ${acadErr?.message}`);
    const pubId = acad.find((r) => r.status === "published")!.id;
    const draftId = acad.find((r) => r.status === "draft")!.id;
    await admin.from("academy_quiz_keys").insert({ resource_id: pubId, answer_key: { q1: "a" } });

    const { data: seenAcad } = await authed.from("academy_resources").select("id").in("id", [pubId, draftId]);
    if (seenAcad?.length === 1 && seenAcad[0].id === pubId) pass("a user sees the published resource and not the draft");
    else fail(`a user's Academy resources: ${JSON.stringify(seenAcad)}`);
    await expectNoRows(authed, "academy_quiz_keys", "authenticated user");
    await expectNoRows(anonClient(), "academy_resources", "anon");
    const writes = await Promise.all([
      authed.from("academy_resources").insert({ kind: "blog", title: "hack", url: "https://example.com/hack" }),
      authed.from("academy_resources").update({ title: "hacked" }).eq("id", pubId).select("id"),
      authed.from("academy_completions").insert({ user_id: userId, resource_id: pubId }),
      authed.from("academy_quiz_attempts").insert({ user_id: userId, resource_id: pubId, correct: 5, passed: true }),
      authed.from("academy_quiz_keys").insert({ resource_id: draftId, answer_key: {} }),
    ]);
    const { data: stillTitle } = await admin.from("academy_resources").select("title").eq("id", pubId).single();
    const { count: myDone } = await admin.from("academy_completions").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (writes.every((w) => w.error || (Array.isArray(w.data) && w.data.length === 0)) && stillTitle?.title === ACADEMY_SENTINEL && !myDone) {
      pass("a user cannot write Academy resources, keys, completions or quiz tries");
    } else {
      fail("a user COULD write to an Academy table");
    }
    const unpublishable = await admin.from("academy_resources").update({ status: "published" }).eq("id", draftId);
    if (unpublishable.error) pass("a resource can't be published without 5 questions");
    else fail("a resource WAS published without a quiz");
    const podcast = await admin
      .from("academy_resources")
      .insert({ kind: "podcast", title: `${ACADEMY_SENTINEL} podcast`, url: `${ACADEMY_SENTINEL_URL}-podcast`, status: "published", questions: [] })
      .select("id");
    const halfQuiz = podcast.data?.length
      ? await admin.from("academy_resources").update({ questions: quizQs.slice(0, 2) }).eq("id", podcast.data[0].id)
      : null;
    if (!podcast.error && halfQuiz?.error) pass("a podcast episode can be published without a quiz, but not with half of one");
    else fail(`podcast without a quiz: ${podcast.error?.message ?? "a published podcast took 2 questions"}`);

    const { error: selfEditorErr } = await authed.from("profiles").update({ is_academy_editor: true }).eq("id", userId);
    const { error: userEditorRpc } = await authed.rpc("set_user_academy_editor", { p_user: userId, p_value: true, p_actor: userId });
    const editorNotAdmin = await admin.rpc("set_user_academy_editor", { p_user: userId, p_value: true, p_actor: userId });
    const { data: notEditor } = await admin.from("profiles").select("is_academy_editor").eq("id", userId).single();
    if (selfEditorErr && userEditorRpc && editorNotAdmin.error && notEditor?.is_academy_editor === false) {
      pass("a user can't make themselves an Academy editor, and set_user_academy_editor needs an admin actor");
    } else {
      fail("the Academy editor flag COULD be set by a non-admin");
    }
    await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    const editorOn = await admin.rpc("set_user_academy_editor", { p_user: userId, p_value: true, p_actor: userId });
    const editorAgain = await admin.rpc("set_user_academy_editor", { p_user: userId, p_value: true, p_actor: userId });
    await admin.from("profiles").update({ is_admin: false }).eq("id", userId);
    const { data: editorAudit } = await admin.from("profile_flag_audit").select("old_value,new_value").eq("profile_id", userId).eq("field", "is_academy_editor");
    if (editorOn.data === true && editorAgain.data === false && editorAudit?.length === 1 && editorAudit[0].new_value === true) {
      pass("set_user_academy_editor sets the flag and writes one audit row (none for a no-op)");
    } else {
      fail(`set_user_academy_editor: ${editorOn.error?.message ?? JSON.stringify({ editorAgain: editorAgain.data, editorAudit })}`);
    }
    const { data: editorSees } = await authed.from("academy_resources").select("id").in("id", [pubId, draftId]);
    if (editorSees?.length === 2) pass("an Academy editor also sees drafts");
    else fail(`an Academy editor sees ${editorSees?.length ?? 0} of the 2 sentinel resources`);
    await expectNoRows(authed, "academy_quiz_keys", "Academy editor");
    const editorWrite = await authed.from("academy_resources").update({ title: "hacked" }).eq("id", pubId).select("id");
    if (editorWrite.error || !editorWrite.data?.length) pass("an Academy editor still can't write resources directly (server actions only)");
    else fail("an Academy editor COULD write academy_resources directly");
    await admin.from("profiles").update({ is_academy_editor: false }).eq("id", userId);

    const upload = await authed.storage.from("academy").upload(`img/${randomBytes(4).toString("hex")}.png`, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { contentType: "image/png" });
    if (upload.error) pass(`a user cannot upload to the academy bucket (${upload.error.message})`);
    else fail("a user COULD upload to the academy bucket");
    const { data: bucket } = await admin.storage.getBucket("academy");
    if (bucket?.public) pass("the academy bucket is public (thumbnails and covers)");
    else fail(`the academy bucket: ${JSON.stringify(bucket)}`);

    await admin.from("academy_completions").insert([
      { user_id: userId, resource_id: pubId, is_imported: true },
      { user_id: userId, resource_id: draftId, is_imported: false },
    ]);
    const { data: myCompletions } = await authed.from("academy_completions").select("resource_id");
    if (myCompletions?.length === 2) pass("a user reads their own completions");
    else fail(`a user's completions: ${JSON.stringify(myCompletions)}`);
    const teamRefused = await authed.rpc("team_academy");
    if (teamRefused.error?.code === "42501") pass("team_academy refuses someone who is neither lead nor admin (42501)");
    else fail("a non-lead COULD call team_academy");
    await admin.from("profiles").update({ is_lead: true }).eq("id", userId);
    const team = await authed.rpc("team_academy").eq("user_id", userId); // the full result is past 1,000 rows
    await admin.from("profiles").update({ is_lead: false }).eq("id", userId);
    const myTeamRows = (team.data ?? []).filter((r) => r.user_id === userId);
    const teamKeys = Object.keys(team.data?.[0] ?? {}).sort().join();
    if (!team.error && myTeamRows.length === 1 && myTeamRows[0].resource_id === pubId && teamKeys === "completed_at,is_imported,resource_id,user_id") {
      pass("a lead's team_academy returns completion columns only, for published resources only");
    } else {
      fail(`team_academy: ${team.error?.message ?? JSON.stringify({ myTeamRows, teamKeys })}`);
    }

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
    const { data: acadLeft } = await admin.from("academy_resources").select("id").like("title", `${ACADEMY_SENTINEL}%`);
    const acadIds = (acadLeft ?? []).map((r) => r.id);
    if (acadIds.length) {
      await admin.from("academy_completions").delete().in("resource_id", acadIds);
      await admin.from("academy_resources").delete().in("id", acadIds); // keys and tries cascade
    }
    await admin.from("staff_titles").delete().in("email", [SENTINEL_TITLE_EMAIL, SENTINEL_TITLE_RENAMED]);
    await admin.from("staff_audit").delete().in("email", [SENTINEL_TITLE_EMAIL, SENTINEL_TITLE_RENAMED, email.toLowerCase()]);
    await admin.from("submission_import_audit").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
    await admin.from("challenges").update({ path_slug: null }).eq("slug", SENTINEL_CHALLENGE);
    await admin.from("paths").delete().eq("slug", SENTINEL_PATH); // its audit rows cascade
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
