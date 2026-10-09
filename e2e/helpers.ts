import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/** Service-role client for test setup/teardown only (runs in the Playwright process, never the browser). */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Put a test user back into the "never onboarded" state. */
export async function resetTrack(email: string) {
  const { error } = await adminDb().from("profiles").update({ track: null }).eq("email", email);
  if (error) throw new Error(`resetTrack(${email}): ${error.message}`);
}
