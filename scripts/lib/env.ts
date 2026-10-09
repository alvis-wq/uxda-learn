import { existsSync } from "node:fs";

// Scripts run outside Next.js, so load .env.local ourselves.
// Existing process env vars (e.g. in cloud sessions / CI) take precedence.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * `--test-project`: point this script at the separate test Supabase project (TEST_SUPABASE_*)
 * instead of the main one — e.g. `npm run db:push -- --test-project` to set it up.
 */
export const TARGET_TEST_PROJECT = process.argv.includes("--test-project");
if (TARGET_TEST_PROJECT) {
  const map = {
    NEXT_PUBLIC_SUPABASE_URL: "TEST_SUPABASE_URL",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "TEST_SUPABASE_ANON_KEY",
    SUPABASE_SERVICE_ROLE_KEY: "TEST_SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_PROJECT_REF: "TEST_SUPABASE_PROJECT_REF",
  } as const;
  const missing = Object.values(map).filter((v) => !process.env[v]);
  if (missing.length) {
    console.error(`--test-project needs ${missing.join(", ")}. See .env.example.`);
    process.exit(1);
  }
  if (process.env.TEST_SUPABASE_PROJECT_REF === process.env.SUPABASE_PROJECT_REF) {
    console.error("TEST_SUPABASE_PROJECT_REF is the main project. Use a separate Supabase project for tests.");
    process.exit(1);
  }
  for (const [target, source] of Object.entries(map)) process.env[target] = process.env[source];
  if (process.env.TEST_SUPABASE_ACCESS_TOKEN) process.env.SUPABASE_ACCESS_TOKEN = process.env.TEST_SUPABASE_ACCESS_TOKEN;
  console.log(`Targeting the TEST project (${process.env.SUPABASE_PROJECT_REF}).`);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}
