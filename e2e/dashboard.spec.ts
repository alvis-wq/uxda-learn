import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { loginAs, stepButtons } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

test("published score appears on the dashboard and the correct leaderboard tab", async ({ page }) => {
  await loginAs(page, "designer");

  // Home hero before any score: zero points, hidden from the leaderboard so not ranked.
  await page.goto("/");
  await expect(page.getByTestId("hero-points")).toContainText("0");
  await expect(page.getByTestId("hero-rank")).toContainText("Not ranked");
  await expect(page.getByTestId("overall-count")).toContainText("0 of");

  // Hidden by default (E2E setup) — the leaderboard says so.
  await page.goto("/leaderboard");
  await expect(page.getByRole("link", { name: "Designers" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("You're hidden from the leaderboard.")).toBeVisible();

  // Partial quiz score: q1 right (4 pts), q2 wrong (0).
  await page.goto("/challenges/e2e-quiz");
  const { next, submit } = stepButtons(page);
  await page.getByLabel("Lavender").check();
  await next.click();
  await page.getByLabel("3", { exact: true }).check();
  await next.click();
  await submit.click();
  await expect(page.getByTestId("attempt-score")).toHaveText("4 / 10");

  // The category's card now says "View result" instead of "Start".
  await page.goto("/categories/e2e-tests");
  const quizCard = page.getByTestId("challenge-card").filter({ has: page.getByRole("link", { name: "[E2E] Quiz" }) });
  await expect(quizCard).toContainText("View result");
  await expect(quizCard).toContainText("Best: 4 / 10");

  await page.goto("/profile");
  await expect(page.getByTestId("stat-total")).toHaveText("4");
  await expect(page.getByTestId("stat-completed")).toHaveText("1");
  await expect(page.getByTestId("stat-pending")).toHaveText("0");
  await expect(page.getByRole("link", { name: "[E2E] Quiz" })).toBeVisible();

  const toggle = page.getByRole("switch", { name: "Show me on the leaderboard" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByText("You're on the leaderboard.")).toBeVisible();

  await page.goto("/leaderboard?group=designers");
  const me = page.getByTestId("leaderboard-me");
  await expect(me).toContainText("Test Designer");
  await expect(me).toContainText("You");
  await expect(me.getByRole("cell").last()).toHaveText("4");

  // Home: total points, rank within the designers group, and the overall tracker.
  await page.goto("/");
  await expect(page.getByTestId("hero-points")).toContainText("4");
  await expect(page.getByTestId("hero-rank")).toContainText("#1");
  await expect(page.getByTestId("hero-rank")).toContainText("Designers");
  await expect(page.getByTestId("overall-count")).toContainText("1 of");

  await page.goto("/leaderboard?group=designers");
  await page.getByRole("link", { name: "Strategists" }).click();
  await expect(page).toHaveURL(/group=strategists/);
  await expect(page.getByText("Test Designer")).toHaveCount(0);
});
