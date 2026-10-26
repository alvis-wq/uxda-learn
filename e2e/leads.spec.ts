import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS, userDb } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

const resetLead = () => adminDb().from("profiles").update({ is_lead: false }).eq("email", TEST_EMAILS.designer);

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await resetLead();
  await adminDb().from("profile_flag_audit").delete().eq("profile_id", (await profileId(TEST_EMAILS.designer))!).eq("field", "is_lead");
});
test.afterAll(async () => {
  await cleanTestUserData();
  await resetLead();
});

test.describe("leads", () => {
  test("someone who is not a lead gets 403 on /team, has no Team link, and can't call the team functions", async ({ page }) => {
    await loginAs(page, "designer");
    await expect(page.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
    const res = await page.goto("/team");
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    const { error } = await (await userDb("designer")).rpc("team_submissions");
    expect(error?.code).toBe("42501");
  });

  test("an admin turns the Lead switch on (and it is audited)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const row = page.getByTestId(`user-row-${TEST_EMAILS.designer}`);
    await row.getByRole("switch", { name: /Lead access/ }).click();
    await expect(page.getByText(/can now see team progress/)).toBeVisible();
    const id = await profileId(TEST_EMAILS.designer);
    await expect
      .poll(async () => (await adminDb().from("profile_flag_audit").select("old_value,new_value").eq("profile_id", id!).eq("field", "is_lead")).data)
      .toEqual([{ old_value: false, new_value: true }]);
  });

  test("a lead sees everyone's progress by category, and can narrow it by track and category", async ({ page }) => {
    // The designer confirmed the read & confirm fixture; the strategist did nothing.
    const designer = (await profileId(TEST_EMAILS.designer))!;
    await adminDb().from("acknowledgements").insert({ user_id: designer, challenge_slug: "e2e-ack", challenge_version: 1 });

    await loginAs(page, "designer");
    await page.getByRole("link", { name: "Team", exact: true }).click();
    await expect(page).toHaveURL(/\/team$/);
    await expect(page.getByRole("heading", { name: "Team progress" })).toBeVisible();
    await expect(page.getByTestId("team-category").filter({ hasText: "[E2E] Test challenges" })).toBeVisible();

    const me = page.locator('[data-testid="team-row"][data-name="Test Designer"]');
    const other = page.locator('[data-testid="team-row"][data-name="Test Strategist"]');
    await expect(me.locator('[data-testid="team-cell"][data-slug="e2e-ack"]')).toHaveAttribute("data-state", "done");
    await expect(other.locator('[data-testid="team-cell"][data-slug="e2e-ack"]')).toHaveAttribute("data-state", "not_started");
    await expect(other.locator('[data-testid="team-cell"][data-slug="e2e-quiz"]')).toHaveAttribute("data-state", "not_started");

    // Track filter: only strategists.
    await page.getByRole("navigation", { name: "Filter by track" }).getByRole("link", { name: "Strategist" }).click();
    await expect(page).toHaveURL(/track=strategist/);
    await expect(other).toBeVisible();
    await expect(me).toHaveCount(0);

    // Category filter: only the fixture category's columns.
    await page.goto("/team?category=e2e-tests");
    await expect(page.getByTestId("team-category")).toHaveCount(1);
    const slugs = await page.getByTestId("team-column").evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));
    expect(slugs).toEqual(expect.arrayContaining(["e2e-ack", "e2e-quiz"]));

    // No answers or emails on the page.
    await expect(page.getByText(TEST_EMAILS.strategist)).toHaveCount(0);
  });

  test("the matrix scrolls inside its box on a phone; the page doesn't", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "designer");
    await page.goto("/team");
    await expect(page.getByTestId("team-matrix")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a lead is not an admin", async ({ page }) => {
    await loginAs(page, "designer");
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(403);
  });

  test("admins see Team progress from the admin menu without the switch", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    await page.getByRole("link", { name: "Team progress" }).click();
    await expect(page).toHaveURL(/\/team$/);
    await expect(page.getByRole("heading", { name: "Team progress" })).toBeVisible();
  });
});
