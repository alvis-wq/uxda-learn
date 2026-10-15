import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { profileIdFor, TEST_EMAILS } from "../tests/support/fixtures";
import { anonClient, serviceClient } from "../tests/support/test-project";
import { testProject } from "./project";

export { TEST_EMAILS };
export type Role = keyof typeof TEST_EMAILS;

/** Service-role client for the TEST project — setup/teardown only, never the browser. */
export function adminDb() {
  if (!testProject) throw new Error("No test Supabase project configured (TEST_SUPABASE_*).");
  return serviceClient(testProject);
}

/** A real signed-in anon-key client for a test user (as the browser would have). */
export async function userDb(role: Role) {
  const { data, error } = await adminDb().auth.admin.generateLink({ type: "magiclink", email: TEST_EMAILS[role] });
  if (error) throw error;
  const client = anonClient(testProject!);
  const { error: vErr } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (vErr) throw vErr;
  return client;
}

export function profileId(email: string) {
  return profileIdFor(adminDb(), email);
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

/** The Stepper's Continue / Back / Submit buttons (Submit is exact: the "Review & submit" step button also matches). */
export const stepButtons = (page: Page) => ({
  next: page.getByRole("button", { name: "Continue" }),
  back: page.getByRole("button", { name: "Back" }),
  submit: page.getByRole("button", { name: "Submit", exact: true }),
});

/**
 * Walks the e2e-screenshot challenge (Brief → Screenshots → Reflection → Review) and stops on the Review step, ready to
 * submit. Expects to start on the challenge page.
 */
export async function fillScreenshotChallenge(page: Page, reflection: string) {
  const { next } = stepButtons(page);
  await expect(page.getByRole("heading", { name: "Brief", exact: true })).toBeVisible();
  await next.click();
  await expect(page.getByRole("heading", { name: "Screenshots", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Add screenshots" })).toBeEnabled();
  await page.getByLabel("Choose screenshot files").setInputFiles(path.join(__dirname, "fixtures", "screenshot.png"));
  await expect(page.getByRole("img", { name: "screenshot.png" })).toBeVisible();
  await next.click();
  await expect(page.getByRole("heading", { name: "Reflection", exact: true })).toBeFocused();
  await page.getByLabel(/^Reflection/).fill(reflection);
  await next.click();
  await expect(page.getByRole("heading", { name: "Review & submit", exact: true })).toBeFocused();
}

/**
 * Pick the app theme for a page. The app defaults to dark and ignores the system setting, so tests choose a theme the
 * way a visitor does: through the saved choice (localStorage "theme"). Persists across navigations on this page.
 */
export async function chooseTheme(page: Page, scheme: "light" | "dark") {
  await page.addInitScript((s) => localStorage.setItem("theme", s), scheme);
}

/** Switch the theme of the page that is already open (same effect as the toggle). */
export async function switchTheme(page: Page, scheme: "light" | "dark") {
  await page.evaluate((s) => {
    localStorage.setItem("theme", s);
    document.documentElement.classList.toggle("dark", s === "dark");
    document.documentElement.style.colorScheme = s;
  }, scheme);
}

/** A not-signed-in email for the "Not signed in yet" list on Admin → Users. */
export const PENDING_TITLE_EMAIL = "e2e-not-signed-in@example.com";

/** Set (or with "" remove) a job title as the seed script would; audited in staff_audit. */
export async function setTitle(email: string, title: string) {
  const { error } = await adminDb().rpc("set_staff_title", { p_email: email, p_title: title, p_source: "seed" });
  if (error) throw new Error(`setTitle(${email}): ${error.message}`);
}

/** Remove the test users' and the pending email's titles and their audit rows (test-only state). */
export async function clearTitles() {
  const emails = [...Object.values(TEST_EMAILS), PENDING_TITLE_EMAIL, PENDING_TITLE_EMAIL.replace("e2e-", "e2e-fixed-")].map(
    (e) => e.toLowerCase(),
  );
  await adminDb().from("staff_titles").delete().in("email", emails);
  await adminDb().from("staff_audit").delete().in("email", emails).neq("field", "track");
}
