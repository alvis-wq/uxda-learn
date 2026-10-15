/**
 * Seed job titles from a JSON file (default data/staff-titles.json; format: staffTitlesFileSchema in
 * src/lib/staff-titles.ts).
 *
 *   npm run seed:titles                       # dry run: prints what would be added or changed
 *   npm run seed:titles -- --apply            # writes it
 *   npm run seed:titles -- other.json --apply # another file
 *
 * Upsert by email through set_staff_title() (source 'seed'), which writes a staff_audit row per change. Titles in
 * the database but not in the file are left alone, and an unchanged title writes nothing, so running it again is safe.
 */
import { readFileSync } from "node:fs";
import "./lib/env";
import { planStaffTitles, staffTitlesFileSchema } from "../src/lib/staff-titles";
import { adminClient } from "./lib/supabase";

async function main() {
  const apply = process.argv.includes("--apply");
  const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "data/staff-titles.json";

  const parsed = staffTitlesFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(`${file} is invalid:`);
    for (const i of parsed.error.issues) console.error(`  ${i.path.join(".") || "(root)"}: ${i.message}`);
    process.exit(1);
  }

  const db = adminClient();
  const { data: existing, error } = await db.from("staff_titles").select("email,job_title");
  if (error) throw new Error(`read staff_titles: ${error.message}`);
  const { data: profiles, error: profilesError } = await db.from("profiles").select("email");
  if (profilesError) throw new Error(`read profiles: ${profilesError.message}`);
  const signedIn = new Set(profiles.map((p) => p.email.toLowerCase()));

  const plan = planStaffTitles(parsed.data, existing);
  const who = (email: string) => (signedIn.has(email) ? "" : "  (not signed in yet)");
  for (const r of plan.add) console.log(`  add     ${r.email}: ${r.job_title}${who(r.email)}`);
  for (const r of plan.change) console.log(`  change  ${r.email}: ${r.old} → ${r.job_title}${who(r.email)}`);
  for (const r of plan.untouched) console.log(`  keep    ${r.email}: ${r.job_title}  (not in ${file})`);
  console.log(
    `\n${plan.add.length} to add, ${plan.change.length} to change, ${plan.same.length} unchanged, ` +
      `${plan.untouched.length} not in the file (kept).`,
  );

  if (!apply) {
    console.log("Dry run — nothing written. Run again with --apply to write it.");
    return;
  }

  let written = 0;
  for (const r of [...plan.add, ...plan.change]) {
    const { error: rpcError } = await db.rpc("set_staff_title", { p_email: r.email, p_title: r.job_title, p_source: "seed" });
    if (rpcError) throw new Error(`${r.email}: ${rpcError.message} (${written} written before this)`);
    written++;
  }
  console.log(`Wrote ${written} title(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
