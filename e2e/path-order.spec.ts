import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installPathOrderFixture, removePathOrderFixture } from "./fixtures";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await installPathOrderFixture();
});
test.afterAll(async () => {
  await cleanTestUserData();
  await removePathOrderFixture();
});

const card = (page: Page, slug: string) => page.locator(`[data-testid="path-card"][data-slug="${slug}"]`);
const milestone = (page: Page, slug: string) => page.locator(`[data-testid="milestone"][data-slug="${slug}"]`);

async function submitQuiz(page: Page, slug: string) {
  await page.goto(`/challenges/${slug}`);
  await page.getByLabel("Yes", { exact: true }).check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
}

test.describe("path order", () => {
  test("a path stays locked until the path it requires is all submitted", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/?category=e2e-path-order");
    await expect(card(page, "e2e-order-first").getByTestId("path-cta")).toContainText("Start");
    await expect(card(page, "e2e-order-second").getByTestId("path-locked")).toHaveText("Unlocks after [E2E] First path");
    await expect(card(page, "e2e-order-second").getByTestId("path-cta")).toHaveCount(0);

    await page.goto("/paths/e2e-order-second");
    await expect(page.getByTestId("path-locked-notice")).toContainText("Unlocks after [E2E] First path.");
    await expect(page.getByTestId("path-locked-notice").getByRole("link", { name: "[E2E] First path" })).toHaveAttribute(
      "href",
      "/paths/e2e-order-first",
    );
    for (const slug of ["e2e-order-3", "e2e-order-4"]) {
      await expect(milestone(page, slug)).toHaveAttribute("data-status", "locked");
      await expect(milestone(page, slug).getByRole("link")).toHaveCount(0);
    }
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    // Not even the first milestone opens.
    await page.goto("/challenges/e2e-order-3");
    await expect(page).toHaveURL(/\/paths\/e2e-order-second$/);
  });

  test("one milestone isn't enough; once every milestone is sent (awaiting review counts) it opens", async ({ page }) => {
    await loginAs(page, "designer");
    await submitQuiz(page, "e2e-order-1");
    await page.goto("/paths/e2e-order-second");
    await expect(page.getByTestId("path-locked-notice")).toBeVisible();

    await page.goto("/challenges/e2e-order-2");
    await page.getByLabel("Link to your frame").fill("https://www.figma.com/design/abc123/E2E?node-id=1-2");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);

    await page.goto("/paths/e2e-order-second");
    await expect(page.getByTestId("path-locked-notice")).toHaveCount(0);
    await expect(milestone(page, "e2e-order-3")).toHaveAttribute("data-status", "not_started");
    await expect(milestone(page, "e2e-order-4")).toHaveAttribute("data-status", "locked");
    await page.goto("/?category=e2e-path-order");
    await expect(card(page, "e2e-order-second").getByTestId("path-cta")).toContainText("Start");
  });
});

test.describe("brief images", () => {
  test("a side image sits right of its text on a wide screen and below it on a phone", async ({ page }) => {
    await loginAs(page, "designer");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/challenges/e2e-order-1");
    const row = page.getByTestId("brief-side-row");
    const list = row.locator("ul");
    const image = row.getByTestId("brief-image");
    let [l, i] = [await list.boundingBox(), await image.boundingBox()];
    expect(i!.x).toBeGreaterThan(l!.x + l!.width - 1);
    const rowBox = (await row.boundingBox())!;
    expect(i!.width / rowBox.width).toBeGreaterThan(0.35);
    expect(i!.width / rowBox.width).toBeLessThan(0.45);

    await page.setViewportSize({ width: 375, height: 812 });
    [l, i] = [await list.boundingBox(), await image.boundingBox()];
    expect(i!.y).toBeGreaterThan(l!.y + l!.height - 1);
    expect(Math.abs(i!.width - (await row.boundingBox())!.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("clicking an image opens it larger; Escape closes it and focus goes back", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-order-1");
    const open = page.getByRole("button", { name: /Example Claude Code sidebar/ });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Example Claude Code sidebar" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Example Claude Code sidebar" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });
});
