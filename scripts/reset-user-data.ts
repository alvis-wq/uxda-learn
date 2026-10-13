/**
 * Wipe learners' progress before launch: every submission (and its evaluations), acknowledgement, saved draft and
 * uploaded screenshot (Storage) of the given accounts. The accounts themselves stay.
 *
 *   npm run reset:users -- alice@uxdesignagency.com bob@uxdesignagency.com            dry run: lists what would go
 *   npm run reset:users -- alice@uxdesignagency.com bob@uxdesignagency.com --apply    deletes
 *
 * The three test accounts (test-strategist@, test-designer@, test-admin@ on the first ALLOWED_EMAIL_DOMAINS domain)
 * are always included, and are removed completely (account and profile too). Run with only `--apply` to clean
 * up test users and nothing else.
 *
 * Idempotent: a second run finds nothing left. Storage is found by listing each user's folder, so a run that
 * stopped half way is finished by running it again. Never touches challenges, categories, scores of other users, the
 * admin allowlist or domains. Uses the service role: point it at the right project (the first line says which), and
 * `--test-project` targets the separate test project instead.
 */
import "./lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { parseResetArgs } from "./lib/reset-args";
import { adminClient } from "./lib/supabase";

type Db = SupabaseClient<Database>;
const BUCKET = "submissions";

type Target = {
  email: string;
  id: string;
  /** A test account: removed entirely, not just emptied. */
  isTest: boolean;
};

type Inventory = {
  submissions: { id: string; status: string }[];
  evaluations: number;
  acknowledgements: number;
  drafts: number;
  files: { path: string; size: number }[];
  /** Test accounts only: things that point at the account and would block, or be orphaned by, its deletion. */
  auditRows: number;
  approvedEvaluations: number;
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** The data of a query, or a thrown error naming what failed. */
function must<T>(what: string, res: { data: T | null; error: { message: string } | null }): T {
  fail(what, res.error);
  if (res.data === null) throw new Error(`${what}: no data`);
  return res.data;
}

/** Every file under `prefix`, following folders (Storage lists a folder as an entry without an id). */
async function listFiles(db: Db, prefix: string): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const data = must(`list ${prefix}`, await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset }));
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) out.push(...(await listFiles(db, path)));
      else out.push({ path, size: Number((entry.metadata as { size?: number } | null)?.size ?? 0) });
    }
    if (data.length < 1000) return out;
  }
}

async function count(db: Db, table: "acknowledgements" | "submission_drafts" | "challenge_settings_audit", column: string, id: string) {
  const { count: n, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, id);
  fail(`count ${table}`, error);
  return n ?? 0;
}

async function inventory(db: Db, t: Target): Promise<Inventory> {
  const subs = must("read submissions", await db.from("submissions").select("id,status").eq("user_id", t.id));
  let evaluations = 0;
  if (subs.length) {
    const { count: n, error: evError } = await db.from("evaluations").select("*", { count: "exact", head: true }).in("submission_id", subs.map((s) => s.id));
    fail("count evaluations", evError);
    evaluations = n ?? 0;
  }
  const inv: Inventory = {
    submissions: subs,
    evaluations,
    acknowledgements: await count(db, "acknowledgements", "user_id", t.id),
    drafts: await count(db, "submission_drafts", "user_id", t.id),
    files: await listFiles(db, t.id),
    auditRows: 0,
    approvedEvaluations: 0,
  };
  if (t.isTest) {
    inv.auditRows = await count(db, "challenge_settings_audit", "changed_by", t.id);
    const { count: n, error: apError } = await db.from("evaluations").select("*", { count: "exact", head: true }).eq("approved_by", t.id);
    fail("count approved evaluations", apError);
    inv.approvedEvaluations = n ?? 0;
  }
  return inv;
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

function describe(inv: Inventory): string {
  const byStatus = new Map<string, number>();
  for (const s of inv.submissions) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
  const statuses = [...byStatus].map(([k, v]) => `${v} ${k}`).join(", ");
  const bytes = inv.files.reduce((sum, f) => sum + f.size, 0);
  const lines = [
    `submissions: ${inv.submissions.length}${statuses ? ` (${statuses})` : ""}`,
    `evaluations: ${inv.evaluations}`,
    `acknowledgements: ${inv.acknowledgements}`,
    `drafts: ${inv.drafts}`,
    `screenshots: ${inv.files.length} file(s)${inv.files.length ? `, ${kb(bytes)}` : ""}`,
  ];
  if (inv.auditRows) lines.push(`challenge settings audit rows by this account: ${inv.auditRows}`);
  if (inv.approvedEvaluations) lines.push(`evaluations approved by this account (approval cleared): ${inv.approvedEvaluations}`);
  return lines.map((l) => `    ${l}`).join("\n");
}

const isEmpty = (inv: Inventory) =>
  !inv.submissions.length && !inv.acknowledgements && !inv.drafts && !inv.files.length && !inv.auditRows && !inv.approvedEvaluations;

async function wipe(db: Db, t: Target, inv: Inventory) {
  if (t.isTest && inv.approvedEvaluations) {
    // evaluations.approved_by has no ON DELETE action: it would block the account's removal.
    fail("clear approvals", (await db.from("evaluations").update({ approved_by: null, approved_at: null }).eq("approved_by", t.id)).error);
  }
  // Evaluations go with their submissions (ON DELETE CASCADE).
  fail("delete submissions", (await db.from("submissions").delete().eq("user_id", t.id)).error);
  fail("delete acknowledgements", (await db.from("acknowledgements").delete().eq("user_id", t.id)).error);
  fail("delete drafts", (await db.from("submission_drafts").delete().eq("user_id", t.id)).error);
  if (t.isTest) {
    // changed_by is ON DELETE SET NULL, which the audit table's own check forbids for admin changes.
    fail("delete audit rows", (await db.from("challenge_settings_audit").delete().eq("changed_by", t.id)).error);
  }
  for (let i = 0; i < inv.files.length; i += 100) {
    const batch = inv.files.slice(i, i + 100).map((f) => f.path);
    const data = must("delete screenshots", await db.storage.from(BUCKET).remove(batch));
    if (data.length !== batch.length) throw new Error(`delete screenshots: ${data.length} of ${batch.length} removed`);
  }
  if (t.isTest) fail("delete test user", (await db.auth.admin.deleteUser(t.id)).error);
}

/** Auth users by email (test accounts can exist in auth without a profile if a sign-up half failed). */
async function findAuthUsers(db: Db, emails: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    fail("list users", error);
    const users = data.users;
    for (const u of users) if (u.email && emails.includes(u.email.toLowerCase())) found.set(u.email.toLowerCase(), u.id);
    if (users.length < 1000) return found;
  }
}

async function main() {
  const args = parseResetArgs(process.argv.slice(2));
  const db = adminClient();
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  console.log(`Project: ${url.host}`);
  console.log(args.apply ? "Mode: APPLY — deleting.\n" : "Mode: dry run — nothing is deleted. Add --apply to delete.\n");

  const targets: Target[] = [];
  const missing: string[] = [];
  if (args.emails.length) {
    const data = must("read profiles", await db.from("profiles").select("id,email").in("email", args.emails));
    for (const email of args.emails) {
      const profile = data.find((p) => p.email.toLowerCase() === email);
      if (profile) targets.push({ email, id: profile.id, isTest: false });
      else missing.push(email);
    }
  }
  const testUsers = await findAuthUsers(db, args.testEmails);
  for (const email of args.testEmails) {
    const id = testUsers.get(email);
    if (id) targets.push({ email, id, isTest: true });
  }

  if (targets.length === 0) console.log("No matching accounts: nothing to do.");
  const inventories = new Map<string, Inventory>();
  for (const t of targets) {
    const inv = await inventory(db, t);
    inventories.set(t.id, inv);
    console.log(`${t.email}${t.isTest ? "  [test account: the account itself is removed too]" : "  [account stays]"}`);
    console.log(describe(inv));
  }
  const absentTests = args.testEmails.filter((e) => !testUsers.has(e));
  if (absentTests.length) console.log(`\nNo leftover test account: ${absentTests.join(", ")}`);
  if (missing.length) console.log(`\nNo account (check the spelling): ${missing.join(", ")}`);

  if (!args.apply) {
    const total = [...inventories.values()].reduce((n, i) => n + i.submissions.length + i.acknowledgements + i.drafts + i.files.length, 0);
    console.log(`\nDry run: ${total} record(s)/file(s) would be deleted${targets.some((t) => t.isTest) ? ", and the test accounts removed" : ""}.`);
    return;
  }

  for (const t of targets) {
    await wipe(db, t, inventories.get(t.id)!);
    console.log(`\nDeleted: ${t.email}`);
  }
  // Verify: whatever is left is reported, not assumed gone.
  const leftovers: string[] = [];
  for (const t of targets.filter((x) => !x.isTest)) {
    const inv = await inventory(db, t);
    if (!isEmpty(inv)) leftovers.push(`${t.email}\n${describe(inv)}`);
  }
  if (leftovers.length) throw new Error(`Something is left after the delete:\n${leftovers.join("\n")}`);
  console.log(`\nDone: ${targets.length} account(s) processed, nothing of theirs left.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
