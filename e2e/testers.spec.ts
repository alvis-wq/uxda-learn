import { expect, test } from "@playwright/test";
import { cleanTestUserData, installTesterFixture, removeTesterFixture } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await installTesterFixture();
  await adminDb().from("profiles").update({ is_tester: false }).eq("email", TEST_EMAILS.designer);
});
test.afterAll(async () => {
  await cleanTestUserData();
  await removeTesterFixture();
  await adminDb().from("profiles").update({ is_tester: false }).eq("email", TEST_EMAILS.designer);
});

const wrong = "Green";

test.describe("testers", () => {
  let overallBefore = "";
  let firstTestAttempt = "";

  test("a user who is not a tester can't see or open a draft", async ({ page }) => {
    await loginAs(page, "designer");
    overallBefore = (await page.getByTestId("overall-count").textContent()) ?? "";
    await expect(page.getByText("[E2E] Draft quiz")).toHaveCount(0);
    await page.goto("/challenges/e2e-draft-quiz");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("an admin turns the Tester switch on (and it is audited)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const row = page.getByTestId(`user-row-${TEST_EMAILS.designer}`);
    await row.getByRole("switch", { name: /Tester access/ }).click();
    await expect(page.getByText(/can now test drafts/)).toBeVisible();
    const id = await profileId(TEST_EMAILS.designer);
    await expect
      .poll(async () => (await adminDb().from("profile_flag_audit").select("new_value,old_value").eq("profile_id", id!)).data)
      .toEqual([{ old_value: false, new_value: true }]);
  });

  test("a tester finds drafts only under the Drafts filter, as dashed cards with a badge; they are not counted", async ({ page }) => {
    await loginAs(page, "designer");
    // Not under All, not in a category (home group or category page).
    await expect(page.getByText("[E2E] Draft quiz")).toHaveCount(0);
    await expect(page.getByTestId("overall-count")).toHaveText(overallBefore);
    await page.goto("/categories/e2e-tests");
    await expect(page.getByText("[E2E] Draft quiz")).toHaveCount(0);
    await page.goto("/");
    await page.getByTestId("filter-button").click();
    const option = page.getByTestId("filter-option").filter({ hasText: "Drafts — testing" });
    await expect(option).toContainText("1"); // the number of drafts
    await option.click();
    await expect(page).toHaveURL(/\?category=drafts$/);
    await expect(page.getByTestId("category-group")).toHaveCount(0); // no section label
    const card = page.getByTestId("challenge-card").filter({ hasText: "[E2E] Draft quiz" });
    await expect(card).toHaveAttribute("data-draft", "");
    await expect(card).toHaveCSS("border-style", "dashed");
    await expect(card.getByTestId("draft-badge")).toHaveText("Draft — testing");
    await expect(page.getByTestId("overall-count")).toHaveText(overallBefore);
    await card.getByRole("link", { name: "[E2E] Draft quiz" }).click();
    await expect(page.getByTestId("draft-badge")).toBeVisible();
    await expect(page.getByTestId("testing-notice")).toContainText("test attempts");
  });

  test("test attempts: result with the answer key, no attempt limit, nothing counted", async ({ page }) => {
    await loginAs(page, "designer");
    for (let n = 1; n <= 4; n++) {
      await page.goto("/challenges/e2e-draft-quiz");
      await page.getByLabel(wrong).check();
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("heading", { name: `Test attempt ${n}` })).toBeVisible();
      await expect(page.getByTestId("test-attempt-notice")).toBeVisible();
      await expect(page.getByTestId("question-mark")).toHaveText("Incorrect");
      await expect(page.getByTestId("right-answer")).toContainText("Lavender"); // always shown on a test attempt
      if (n === 1) firstTestAttempt = page.url();
    }
    const id = await profileId(TEST_EMAILS.designer);
    const { data } = await adminDb().from("submissions").select("attempt,is_test,status").eq("user_id", id!).order("attempt");
    expect(data).toEqual([1, 2, 3, 4].map((attempt) => ({ attempt, is_test: true, status: "published" })));

    // Nothing counts: profile totals, home progress, leaderboard.
    await page.goto("/profile");
    await expect(page.getByTestId("stat-total")).toHaveText("0");
    await expect(page.getByTestId("stat-completed")).toHaveText("0");
    await page.goto("/");
    await expect(page.getByTestId("hero-points")).toContainText("0");
    await expect(page.getByTestId("overall-count")).toHaveText(overallBefore);
  });

  test("feedback goes to the admin, newest first, with name and date", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-draft-quiz");
    await page.getByLabel("Feedback for Alvis").fill("First note");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByTestId("feedback-status")).toContainText("Sent");
    await page.getByLabel("Feedback for Alvis").fill("Second note");
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByTestId("feedback-status")).toContainText("Sent");

    await loginAs(page, "admin");
    await page.goto("/admin/content/e2e-draft-quiz");
    const items = page.getByTestId("feedback-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Second note");
    await expect(items.nth(1)).toContainText("First note");
    await expect(items.nth(0)).toContainText(/Test Designer|designer/i);
    await expect(page.getByTestId("test-attempts").getByRole("link")).toHaveCount(4);
  });

  test("when it is published the tester starts fresh; admins still see the test attempts", async ({ page }) => {
    await adminDb().from("challenges").update({ status: "published" }).eq("slug", "e2e-draft-quiz");
    await loginAs(page, "designer");
    await expect(page.getByTestId("draft-badge")).toHaveCount(0);
    await page.goto("/challenges/e2e-draft-quiz");
    await expect(page.getByText("Attempt 1 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your attempts" })).toHaveCount(0);
    await expect(page.getByTestId("feedback-form")).toHaveCount(0);
    await page.goto(firstTestAttempt);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();

    await loginAs(page, "admin");
    await page.goto("/admin/content/e2e-draft-quiz");
    await page.getByTestId("test-attempts").getByRole("link").first().click();
    await expect(page.getByText("Test attempt — doesn't count")).toBeVisible();
  });
});
