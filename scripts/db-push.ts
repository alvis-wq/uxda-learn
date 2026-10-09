/**
 * Apply pending migrations in supabase/migrations via the Supabase Management API.
 *
 * Direct Postgres connections (what `supabase db push` uses) aren't available everywhere,
 * so this records applied versions in the same table the CLI uses
 * (supabase_migrations.schema_migrations) — the two stay interchangeable.
 * Each migration runs in a single transaction together with its bookkeeping row.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import "./lib/env";
import { lit, runSql } from "./lib/management-api";

const DIR = path.join("supabase", "migrations");

async function main() {
  await runSql(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);

  const applied = new Set(
    (await runSql<{ version: string }>(
      "select version from supabase_migrations.schema_migrations",
    )).map((r) => r.version),
  );

  const files = readdirSync(DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const pending = files.filter((f) => !applied.has(f.split("_")[0]));
  if (pending.length === 0) {
    console.log("Database is up to date.");
    return;
  }

  for (const file of pending) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    const name = rest.join("_");
    const sql = readFileSync(path.join(DIR, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    await runSql(`begin;
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values (${lit(version)}, ${lit(name)}, array[${lit(sql)}]);
commit;`);
    console.log("done");
  }
  console.log(`Applied ${pending.length} migration(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
