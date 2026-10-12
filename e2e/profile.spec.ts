import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { adminDb, loginAs, profileId, switchTheme, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);
test.afterAll(cleanTestUserData);

test.describe("profile: your challenges", () => {
  test("groups attempts per challenge with the score that counts on top", async ({ page }) => {
    await loginAs(page, "designer");
    const userId = (await profileId(TEST_EMAILS.designer))!;
    const sub = (attempt: number, status: string, final_score: number | null, feedback: string | null, day: number) => ({
      user_id: userId,
      challenge_slug: "e2e-screenshot",
      challenge_version: 1,
      attempt,
      status: status as "published",
      final_score,
      max_score: 10,
      feedback,
      submitted_at: `2026-10-0${day}T10:00:00Z`,
      published_at: status === "published" ? `2026-10-0${day}T12:00:00Z` : null,
    });
    const { error } = await adminDb()
      .from("submissions")
      .insert([
        sub(1, "published", 3, "Too thin — show the error state.", 1),
        sub(2, "published", 8, "Much better.", 2),
        sub(3, "ai_reviewed", 9, "AI draft feedback that must stay hidden.", 3),
      ]);
    expect(error).toBeNull();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Your challenges" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feedback history" })).toHaveCount(0);

    const group = page.getByTestId("challenge-history").filter({ hasText: "[E2E] Screenshot" });
    await expect(group).toHaveCount(1);
    // Headline: the best published attempt (2), even though attempt 3 is newer.
    await expect(group.locator('[data-label="best"]').first()).toHaveText("Best score");
    await expect(group.getByText("Attempt 2", { exact: true })).toBeVisible();
    await expect(group.getByText("3 of 3 attempts used")).toBeVisible();
    await expect(group.getByText("Much better.")).toBeVisible();
    await expect(group.getByTestId("newer-attempt")).toContainText("Awaiting review");
    // AI-reviewed (not yet approved) score and feedback are never shown.
    await expect(group.getByText("AI draft feedback that must stay hidden.")).toHaveCount(0);

    // Earlier attempts are collapsed until opened.
    const rows = group.getByTestId("attempt-row");
    await expect(rows.first()).toBeHidden();
    await group.getByText("2 other attempts").click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Attempt 3");
    await expect(rows.nth(0)).toContainText("Awaiting review");
    await expect(rows.nth(0).getByTestId("attempt-score")).toHaveCount(0);
    await expect(rows.nth(1)).toContainText("Attempt 1");
    await expect(rows.nth(1)).toContainText("Earlier attempt");
    await expect(rows.nth(1).getByTestId("attempt-score")).toHaveAttribute("data-low", "true");
    await expect(rows.nth(1)).toContainText("Too thin — show the error state.");

    // Warning colour and muted rows pass contrast checks in both themes.
    for (const scheme of ["light", "dark"] as const) {
      await switchTheme(page, scheme);
      const results = await new AxeBuilder({ page }).include('[data-testid="challenge-history"]').withTags(["wcag2aa"]).analyze();
      expect(results.violations.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
    }
  });
});
