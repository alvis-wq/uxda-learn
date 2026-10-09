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

type PrivateTable = "challenge_keys" | "admin_allowlist" | "allowed_email_domains";

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
    if (userId) await admin.auth.admin.deleteUser(userId);
    await admin.from("acknowledgements").delete().eq("challenge_slug", SENTINEL_CHALLENGE);
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
