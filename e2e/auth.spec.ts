import { expect, test } from "@playwright/test";
import { formatAllowedDomains } from "../src/lib/auth/domain";
import { resetTrack, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe("auth", () => {
  test("unauthenticated visitors are sent to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  });

  test("test user logs in, completes onboarding and reaches home", async ({ page }) => {
    await resetTrack(TEST_EMAILS.strategist);

    await page.goto("/login");
    await page.getByRole("button", { name: "Strategist" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: /Welcome, Test/ })).toBeVisible();
    // Only the four tracks on offer; Account Manager and Marketing Assistant are hidden.
    await expect(page.getByRole("radio")).toHaveCount(4);
    for (const track of ["Strategist", "Designer", "Motion Designer", "Management"]) {
      await expect(page.getByRole("radio", { name: new RegExp(`^${track}\\b`) })).toHaveCount(1);
    }
    await expect(page.getByRole("radio", { name: /Founders, executives and assistants/ })).toHaveCount(1);
    for (const hidden of ["Account Manager", "Marketing Assistant"]) {
      await expect(page.getByRole("radio", { name: new RegExp(hidden) })).toHaveCount(0);
    }
    await page.getByText("Strategist", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Welcome, Test" })).toBeVisible();
    await expect(page.getByText("Strategist track", { exact: true })).toBeVisible();

    // Onboarding is one-time: going back there now redirects home.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/$/);

    // Signed-in users don't see /login.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("non-UXDA accounts get a friendly error", async ({ page }) => {
    // What Supabase sends back when the signup trigger rejects the email domain.
    await page.goto("/auth/callback?error=server_error&error_description=Database+error+saving+new+user");
    await expect(page).toHaveURL(/\/auth\/error\?reason=domain$/);
    await expect(page.getByRole("heading", { name: "This account can't be used here" })).toBeVisible();
    await expect(page.getByText(formatAllowedDomains(), { exact: false })).toBeVisible();
  });
});
