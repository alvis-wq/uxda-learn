import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cleanTestUserData, installPathFixture, removePathFixture } from "./fixtures";
import { adminDb, chooseTheme, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await installPathFixture();
});
test.afterAll(async () => {
  await cleanTestUserData();
  await removePathFixture();
});

const milestone = (page: import("@playwright/test").Page, slug: string) => page.locator(`[data-testid="milestone"][data-slug="${slug}"]`);

test.describe("learning paths", () => {
  test("home lists the path as one card, never its milestones", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/?category=e2e-paths");
    const card = page.getByTestId("path-card");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("[E2E] Three steps");
    await expect(card.getByTestId("path-progress")).toHaveText("0 of 3 · 0/40 pts");
    await expect(card.getByTestId("path-cta")).toContainText("Start");
    await expect(page.getByTestId("challenge-card")).toHaveCount(0);
  });

  test("the roadmap locks the later milestones, and a locked one can't be opened", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/paths/e2e-path");
    await expect(page.getByTestId("path-done-count")).toHaveText("0 of 3 done");
    await expect(milestone(page, "e2e-path-1")).toHaveAttribute("data-status", "not_started");
    await expect(milestone(page, "e2e-path-2")).toHaveAttribute("data-status", "locked");
    await expect(milestone(page, "e2e-path-2").getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("before-you-submit")).toContainText("360 px");
    await expect(page.getByTestId("before-you-start")).toContainText("You need Figma open.");

    await page.goto("/challenges/e2e-path-2");
    await expect(page).toHaveURL(/\/paths\/e2e-path$/);
  });

  test("submitting a milestone unlocks the next one at once, without waiting for review", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/paths/e2e-path");
    await milestone(page, "e2e-path-1").getByRole("link", { name: "First step" }).click();
    await expect(page.getByTestId("back-to-path")).toHaveAttribute("href", "/paths/e2e-path");
    await expect(page.getByTestId("milestone-position")).toContainText("Milestone 1 of 3");

    await page.getByLabel("Figma link").fill("https://www.figma.com/design/abc123/E2E?node-id=1-2");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);

    await page.goto("/challenges/e2e-path-1");
    await expect(page.getByTestId("next-milestone")).toContainText("Step 2");
    await page.goto("/paths/e2e-path");
    await expect(milestone(page, "e2e-path-1")).toHaveAttribute("data-status", "awaiting_review");
    await expect(milestone(page, "e2e-path-2")).toHaveAttribute("data-status", "not_started");
    await expect(milestone(page, "e2e-path-3")).toHaveAttribute("data-status", "locked");

    // Step 2 is a quiz: published at once, so the track fills below it.
    await milestone(page, "e2e-path-2").getByRole("link").click();
    await page.getByLabel("Yes", { exact: true }).check();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
    await page.goto("/paths/e2e-path");
    await expect(milestone(page, "e2e-path-2")).toHaveAttribute("data-status", "done");
    await expect(milestone(page, "e2e-path-2").getByTestId("milestone-score")).toHaveText("10 / 10 pts");
    await expect(milestone(page, "e2e-path-2").getByTestId("track-segment")).toHaveAttribute("data-filled", "");
    await expect(page.getByTestId("path-done-count")).toHaveText("1 of 3 done");

    await page.goto("/?category=e2e-paths");
    await expect(page.getByTestId("path-progress")).toHaveText("1 of 3 · 10/40 pts");
    await expect(page.getByTestId("path-cta")).toContainText("Continue");
  });

  test("an admin imports earlier progress; it counts at once and is audited", async ({ page, browser }) => {
    const strategistId = await profileId(TEST_EMAILS.strategist);
    test.skip(!strategistId, "the strategist test user hasn't signed in yet");
    await loginAs(page, "admin");
    await page.goto(`/admin/users/${strategistId}`);
    const row = page.locator('[data-testid="user-milestone"][data-slug="e2e-path-1"]');
    await row.getByTestId("import-open").click();
    await row.getByLabel(/^Score/).fill("18");
    await row.getByRole("button", { name: "Save import" }).click();
    await expect(row.getByTestId("user-milestone-status")).toHaveText("Done");
    await expect(page.getByTestId("import-history")).toContainText("Imported e2e-path-1: done, 18/20");

    const { data } = await adminDb()
      .from("submissions")
      .select("status,final_score,is_imported,feedback")
      .eq("user_id", strategistId!)
      .eq("challenge_slug", "e2e-path-1")
      .eq("is_test", false);
    expect(data).toEqual([{ status: "published", final_score: 18, is_imported: true, feedback: "Completed before UXDA Learn" }]);

    const learner = await browser.newPage();
    await loginAs(learner, "strategist");
    await learner.goto("/paths/e2e-path");
    await expect(milestone(learner, "e2e-path-1")).toHaveAttribute("data-status", "done");
    await expect(milestone(learner, "e2e-path-2")).toHaveAttribute("data-status", "not_started");
    await learner.close();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the path page passes axe and fits at 375px (${scheme} mode)`, async ({ page }) => {
      await chooseTheme(page, scheme);
      await page.setViewportSize({ width: 375, height: 812 });
      await loginAs(page, "designer");
      for (const url of ["/paths/e2e-path", "/?category=e2e-paths"]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => `${url}: ${v.id}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      }
    });
  }
});
