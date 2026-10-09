import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { requireEnv } from "./env";

/** Service-role client for CLI scripts. Bypasses RLS — never use in app code paths sent to clients. */
export function adminClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Anon (publishable key) client, as a browser would have before signing in. */
export function anonClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
