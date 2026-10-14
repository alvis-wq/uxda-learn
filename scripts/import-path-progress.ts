/**
 * Import path progress made before UXDA Learn, from a JSON file (format: importFileSchema in
 * src/lib/admin/path-import.ts; example: data/auto-layout-import.json).
 *
 *   npx tsx scripts/import-path-progress.ts <file.json> --as <admin email>            # dry run: prints the plan
 *   npx tsx scripts/import-path-progress.ts <file.json> --as <admin email> --apply    # writes it
 *
 * Each entry becomes the user's next real attempt on that milestone, flagged imported by the admin given with --as,
 * through import_submission() (which checks everything again and writes the audit row). The path must be published.
 * People who haven't signed in yet are skipped; a milestone that already has an imported attempt is skipped too, so
 * running it again changes nothing.
 */
import { readFileSync } from "node:fs";
import "./lib/env";
import { IMPORT_STATUS, importFileSchema, planImport } from "../src/lib/admin/path-import";
import { adminClient } from "./lib/supabase";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const actorEmail = arg("--as")?.toLowerCase();
  const file = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--as");
  if (!file || !actorEmail) {
    console.error("Usage: npx tsx scripts/import-path-progress.ts <file.json> --as <admin email> [--apply]");
    process.exit(1);
  }

  const parsed = importFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(`${file} is invalid:`);
    for (const i of parsed.error.issues) console.error(`  ${i.path.join(".") || "(root)"}: ${i.message}`);
    process.exit(1);
  }
  const data = parsed.data;

  const db = adminClient();
  // A small team: read every profile once and match emails without case (they're stored as Google returns them).
  const { data: profiles, error: profilesError } = await db.from("profiles").select("id,email,is_admin");
  if (profilesError) throw new Error(`read profiles: ${profilesError.message}`);
  const actor = profiles.find((p) => p.email.toLowerCase() === actorEmail);
  if (!actor?.is_admin) {
    console.error(`--as ${actorEmail}: no admin with that email has signed in.`);
    process.exit(1);
  }

  const { data: path, error: pathError } = await db.from("paths").select("slug,status,milestones").eq("slug", data.path).maybeSingle();
  if (pathError) throw new Error(`read path: ${pathError.message}`);
  const slugs = path?.milestones ?? [];
  const emails = data.users.map((u) => u.email);
  const { data: milestones, error: milestonesError } = slugs.length
    ? await db.from("challenges").select("slug,status,points").in("slug", slugs)
    : { data: [], error: null };
  if (milestonesError) throw new Error(`read milestones: ${milestonesError.message}`);
  const known = profiles.filter((p) => emails.includes(p.email.toLowerCase())).map((p) => ({ id: p.id, email: p.email }));
  const { data: attempts, error: attemptsError } = known.length && slugs.length
    ? await db
        .from("submissions")
        .select("user_id,challenge_slug,attempt,status,final_score,max_score,is_imported")
        .in("user_id", known.map((u) => u.id))
        .in("challenge_slug", slugs)
        .eq("is_test", false)
    : { data: [], error: null };
  if (attemptsError) throw new Error(`read submissions: ${attemptsError.message}`);

  const { steps, errors } = planImport(data, { path, milestones: milestones ?? [], users: known, attempts: attempts ?? [] });
  if (errors.length) {
    console.error("Nothing imported — fix the file first:");
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log(`${apply ? "Importing" : "Dry run"}: path ${data.path} (${path?.status}), as ${actorEmail}`);
  const imports = steps.filter((s) => s.kind === "import");
  for (const s of steps) {
    if (s.kind === "skip") console.log(`  skip    ${s.email}${s.slug ? ` ${s.slug}` : ""}: ${s.reason}`);
    else console.log(`  import  ${s.email} ${s.slug}: ${s.outcome === "done" ? "done" : "changes requested"}, ${s.score} pts — “${s.feedback}”`);
  }
  if (!apply) {
    console.log(`\nDry run: ${imports.length} import(s) would be written. Add --apply to write them.`);
    return;
  }

  let written = 0;
  for (const s of imports) {
    const { error } = await db.rpc("import_submission", {
      p_user: s.userId,
      p_challenge: s.slug,
      p_status: IMPORT_STATUS[s.outcome],
      p_score: s.score,
      p_feedback: s.feedback,
      p_source: "script",
      p_actor: actor.id,
    });
    if (error) console.error(`  FAILED  ${s.email} ${s.slug}: ${error.message}`);
    else written++;
  }
  console.log(`\nImported ${written} of ${imports.length}.`);
  if (written !== imports.length) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
