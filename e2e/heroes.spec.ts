import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { validateHeroesFile } from "../src/lib/heroes";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });

const HEROES = validateHeroesFile(path.resolve(__dirname, ".."));
const cards = (page: Page) => page.getByTestId("hero-grid").getByRole("article");
const inner = (card: Locator) => card.locator(".hero-card-inner");
const back = (card: Locator) => card.locator(".hero-card-back");
const flippedTransform = /^matrix3d\(-1,/; // rotateY(180deg)

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
  const first = cards(page).first();
  await expect(page.getByRole("article", { name: HEROES[0].person, exact: true }).first()).toBeAttached();
  await expect(first).toContainText(HEROES[0].hero);
  await expect(first).toContainText(HEROES[0].description);
  await expect(first.getByRole("listitem")).toHaveText(HEROES[0].traits);
  // Portraits are lazy next/image files.
  await expect(first.getByRole("img", { name: `Portrait of ${HEROES[0].person}` })).toHaveAttribute("loading", "lazy");
  await expect(first.getByRole("img")).toHaveAttribute("src", /\/_next\/image\?url=%2Fheroes%2F/);
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

test.describe("flip (full motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("flips on hover and on keyboard focus, with a visible focus ring", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const card = cards(page).first();
    await expect(inner(card)).not.toHaveCSS("transform", flippedTransform);

    await card.hover();
    await expect(inner(card)).toHaveCSS("transform", flippedTransform);
    await page.mouse.move(0, 0);
    await expect(inner(card)).not.toHaveCSS("transform", flippedTransform);

    await card.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab"); // keyboard focus → :focus-visible
    await expect(card).toBeFocused();
    await expect(inner(card)).toHaveCSS("transform", flippedTransform);
    await expect(card).not.toHaveCSS("box-shadow", "none");
  });
});

test.describe("flip on tap (touch)", () => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test("a tap flips the card, a second tap flips it back", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const card = cards(page).first();
    await card.tap();
    await expect(card).toHaveAttribute("data-flipped", "true");
    await expect(inner(card)).toHaveCSS("transform", flippedTransform);
    await card.tap();
    await expect(card).not.toHaveAttribute("data-flipped");
  });
});

test("reduced motion: no 3D flip, the back crossfades in", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/heroes");
  const card = cards(page).first();
  await expect(back(card)).toHaveCSS("opacity", "0");
  await card.hover();
  await expect(back(card)).toHaveCSS("opacity", "1");
  await expect(inner(card)).toHaveCSS("transform", "none");
});
