import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { validateHeroesFile } from "../src/lib/heroes";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });

const HEROES = validateHeroesFile(path.resolve(__dirname, ".."));
const cards = (page: Page) => page.getByTestId("hero-grid").getByRole("article");
const card = (page: Page, i: number) => page.getByTestId("hero-grid").getByRole("button").nth(i);
const body = (c: Locator) => c.locator(".tilted-card__body");
const back = (c: Locator) => c.locator(".tilted-card__back");
/** The body's inline transform: the tilt (rotateX/rotateY) plus the flip (rotateY + 180). */
const rotateY = async (c: Locator) => Number((await body(c).evaluate((e) => e.style.transform)).match(/rotateY\((-?[\d.]+)deg\)/)?.[1] ?? 0);

/** Number of cards in each visual row (by their top edge). */
async function rowSizes(page: Page): Promise<number[]> {
  const tops = await cards(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const rows: number[] = [];
  tops.forEach((t, i) => (i > 0 && t === tops[i - 1] ? rows[rows.length - 1]++ : rows.push(1)));
  return rows;
}

test("/leaderboard redirects to /heroes, keeping the group", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/leaderboard?group=designers");
  await expect(page).toHaveURL(/\/heroes\?group=designers$/);
  await expect(page.getByRole("link", { name: "Designers" })).toHaveAttribute("aria-current", "page");
});

test("page structure: Heroes, the leaderboard, then the Superhero Team in file order", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/heroes");
  await expect(page).toHaveTitle("Heroes · UXDA Learn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heroes");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["UXDA Learn Leaderboard", "UXDA Superhero Team"]);
  await expect(page.getByText("Meet the heroes behind UXDA: who they are and what makes them super.")).toBeVisible();

  await expect(cards(page)).toHaveCount(HEROES.length);
  // Each card is named by the person, and both sides' text is in the accessibility tree.
  // Each card: an article named by the person, both sides' text readable, and a flip toggle named after them.
  const first = page.getByRole("article", { name: HEROES[0].person, exact: true }).first();
  await expect(first).toContainText(HEROES[0].hero);
  await expect(first).toContainText(HEROES[0].description);
  await expect(first.getByRole("list", { name: `${HEROES[0].person}'s traits` }).getByRole("listitem")).toHaveText(HEROES[0].traits);
  await expect(card(page, 0)).toHaveAccessibleName(`${HEROES[0].person}, ${HEROES[0].hero}`);
  await expect(card(page, 0)).toHaveAttribute("aria-pressed", "false");
  // Portraits: next/image's optimized URLs, lazy, 3:4.
  const img = first.locator("img");
  await expect(img).toHaveAttribute("loading", "lazy");
  await expect(img).toHaveAttribute("src", /\/_next\/image\?url=%2Fheroes%2F/);
  await expect(img).toHaveAttribute("srcset", /\/_next\/image\?url=%2Fheroes%2F/);
  const box = (await card(page, 0).boundingBox())!;
  expect(box.height / box.width).toBeCloseTo(4 / 3, 2);
});

for (const [width, perRow] of [
  [1280, 4],
  [820, 3],
  [375, 2],
] as const) {
  test(`${width}px: top row of 2 (centred), then ${perRow} per row, no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const rows = await rowSizes(page);
    expect(rows[0]).toBe(2);
    expect(rows.slice(1, -1).every((n) => n === perRow), rows.join(",")).toBe(true);

    const grid = (await page.getByTestId("hero-grid").boundingBox())!;
    const a = (await cards(page).nth(0).boundingBox())!;
    const b = (await cards(page).nth(1).boundingBox())!;
    expect((a.x + b.x + b.width) / 2).toBeCloseTo(grid.x + grid.width / 2, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test.describe("tilt and flip (full motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("hover only tilts; click, Enter and Space flip; visible focus ring", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const c = card(page, 0);
    await c.hover({ position: { x: 10, y: 10 } });
    await expect.poll(() => rotateY(c)).toBeLessThan(-3); // tilted toward the pointer
    await expect(c).not.toHaveAttribute("data-flipped");

    await c.click();
    await expect(c).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => rotateY(c)).toBeGreaterThan(160);
    await c.click();
    await expect(c).toHaveAttribute("aria-pressed", "false");

    await page.mouse.move(0, 0);
    await c.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab"); // keyboard focus → :focus-visible
    await expect(c).toBeFocused();
    expect(await c.evaluate((e) => getComputedStyle(e, "::after").borderTopWidth)).toBe("3px");
    await page.keyboard.press("Enter");
    await expect(c).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(c).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("flip on tap (touch)", () => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test("a tap flips the card, a second tap flips it back; the hint says Tap", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const c = card(page, 0);
    await expect(c.getByText("Tap to flip")).toBeVisible();
    await c.tap();
    await expect(c).toHaveAttribute("data-flipped", "");
    await expect.poll(() => rotateY(c)).toBeGreaterThan(160);
    await c.tap();
    await expect(c).not.toHaveAttribute("data-flipped");
  });
});

test("reduced motion: no tilt, the flip is a crossfade", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/heroes");
  const c = card(page, 0);
  await expect(c.getByText("Click to flip")).toBeVisible();
  await c.hover({ position: { x: 10, y: 10 } });
  await expect(back(c)).toHaveCSS("opacity", "0");
  await c.click();
  await expect(back(c)).toHaveCSS("opacity", "1");
  expect(await rotateY(c)).toBe(0);
  expect(await body(c).evaluate((e) => e.style.transform)).toMatch(/rotateX\(0deg\) rotateY\(0deg\) scale\(1\)/);
});
