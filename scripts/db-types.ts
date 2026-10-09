/** Regenerate src/lib/database.types.ts from the linked Supabase project (Management API). */
import { writeFileSync } from "node:fs";
import "./lib/env";
import { getTypescriptTypes } from "./lib/management-api";

const OUT = "src/lib/database.types.ts";

getTypescriptTypes(["public"])
  .then((types) => {
    writeFileSync(OUT, types);
    console.log(`Wrote ${OUT}`);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
