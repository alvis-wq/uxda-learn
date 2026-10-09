import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

export const TEST_EMAILS = {
  strategist: "test-strategist@theuxda.com",
  designer: "test-designer@theuxda.com",
  admin: "test-admin@theuxda.com",
} as const;
export type Role = keyof typeof TEST_EMAILS;

/** Service-role client for test setup/teardown only (runs in the Playwright process, never the browser). */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A real signed-in anon-key client for a test user (as the browser would have). */
export async function userDb(role: Role) {
  const admin = adminDb();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAILS[role] });
  if (error) throw error;
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: vErr } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (vErr) throw vErr;
  return client;
}

export async function profileId(email: string): Promise<string | null> {
  const { data } = await adminDb().from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

/** Put a test user back into the "never onboarded" state. */
export async function resetTrack(email: string) {
  const { error } = await adminDb().from("profiles").update({ track: null }).eq("email", email);
  if (error) throw new Error(`resetTrack(${email}): ${error.message}`);
}

const TRACK_FOR: Record<Role, "Strategist" | "Designer"> = {
  strategist: "Strategist",
  designer: "Designer",
  admin: "Strategist",
};

/** Sign in through the dev test login, completing onboarding if needed. */
export async function loginAs(page: Page, role: Role) {
  await page.context().clearCookies();
  await page.goto("/login");
  const button = { strategist: "Strategist", designer: "Designer", admin: "Admin" }[role];
  await page.getByRole("button", { name: button, exact: true }).click();
  const signOut = page.getByRole("button", { name: "Sign out" });
  const onboard = page.getByRole("button", { name: "Continue" });
  await expect(signOut.or(onboard)).toBeVisible();
  if (await onboard.isVisible()) {
    await page.getByText(TRACK_FOR[role], { exact: true }).click();
    await onboard.click();
  }
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}
