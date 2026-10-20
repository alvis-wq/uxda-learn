import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { heroForEmail, validateHeroesFile } from "../src/lib/heroes";
import { loginAs, TEST_EMAILS } from "./helpers";
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

test("/heroes is the Superhero Team only, in file order; /leaderboard is its own page", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/heroes");
  await expect(page).toHaveTitle("Heroes · UXDA Learn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("UXDA Superhero Team");
  await expect(page.getByRole("navigation", { name: "Leaderboard groups" })).toHaveCount(0);
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
  test(`${width}px: one even grid, ${perRow} per row in file order, no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, "strategist");
    await page.goto("/heroes");
    const rows = await rowSizes(page);
    expect(rows.slice(0, -1).every((n) => n === perRow), rows.join(",")).toBe(true);
    expect(rows.at(-1)).toBeLessThanOrEqual(perRow);
    // Row 1 is the first heroes in the file (desktop: Alex, Linda, Ernests, Inese — as on the team page).
    const firstRow = HEROES.slice(0, perRow).map((h) => h.person);
    for (const [i, person] of firstRow.entries()) await expect(cards(page).nth(i)).toHaveAccessibleName(person);

    // The first card starts at the grid's left edge (no offset row).
    const grid = (await page.getByTestId("hero-grid").boundingBox())!;
    expect((await cards(page).nth(0).boundingBox())!.x).toBeCloseTo(grid.x, 0);
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
    // The violet stroke shows on hover.
    await expect.poll(() => c.locator(".tilted-card__front").evaluate((e) => getComputedStyle(e, "::after").opacity)).toBe("1");

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

test("/leaderboard: the leaderboard only", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/leaderboard");
  await expect(page).toHaveURL(/\/leaderboard$/); // no redirect any more
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("UXDA Learn Leaderboard");
  await expect(page.getByTestId("hero-grid")).toHaveCount(0);
});

test("reduced motion: the hover stroke appears without a fade", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/heroes");
  const front = card(page, 0).locator(".tilted-card__front");
  expect(await front.evaluate((e) => getComputedStyle(e, "::after").transitionDuration)).toBe("0s");
  await card(page, 0).hover();
  expect(await front.evaluate((e) => getComputedStyle(e, "::after").opacity)).toBe("1");
});

test("profile: no hero for the email → the header has the name block only", async ({ page }) => {
  expect(heroForEmail(HEROES, TEST_EMAILS.strategist)).toBeUndefined();
  await loginAs(page, "strategist");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("profile-hero")).toHaveCount(0);
});
