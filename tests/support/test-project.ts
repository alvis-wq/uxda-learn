import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

/**
 * E2E and integration tests write real data, so they run against a SEPARATE Supabase
 * project given by TEST_SUPABASE_* env vars — never the main one. Not configured → skip.
 */
export type TestProject = { url: string; anonKey: string; serviceRoleKey: string };

const VARS = ["TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"] as const;

function projectKey(url: string): string {
  const u = new URL(url);
  const m = u.hostname.match(/^([a-z0-9]+)\.supabase\.(co|in)$/);
  return m ? m[1] : u.origin;
}

export function resolveTestProject(env: Record<string, string | undefined> = process.env): {
  project: TestProject | null;
  reason: string;
} {
  const set = VARS.filter((v) => env[v]);
  if (set.length === 0) {
    return { project: null, reason: `Skipped: set ${VARS.join(", ")} to run against a test Supabase project.` };
  }
  if (set.length !== VARS.length) {
    throw new Error(`Incomplete test project config: missing ${VARS.filter((v) => !env[v]).join(", ")}.`);
  }
  const url = env.TEST_SUPABASE_URL!;
  const main = [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_PROJECT_REF && `https://${env.SUPABASE_PROJECT_REF}.supabase.co`];
  if (main.some((m) => m && projectKey(m) === projectKey(url))) {
    throw new Error("TEST_SUPABASE_URL points at the main project. Tests need a separate Supabase project.");
  }
  return {
    project: { url, anonKey: env.TEST_SUPABASE_ANON_KEY!, serviceRoleKey: env.TEST_SUPABASE_SERVICE_ROLE_KEY! },
    reason: "",
  };
}

export function serviceClient(p: TestProject) {
  return createClient<Database>(p.url, p.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(p: TestProject) {
  return createClient<Database>(p.url, p.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
