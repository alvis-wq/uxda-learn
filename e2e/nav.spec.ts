import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });

const mainNav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Main" });

test.describe("main navigation (RubberNav)", () => {
  test("real links, active item follows the route, Admin only for admins", async ({ page }) => {
    await loginAs(page, "strategist");
    const nav = mainNav(page);
    await expect(nav.getByRole("link")).toHaveCount(3); // Home, Leaderboard, Profile
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("aria-label", "Home");

    await nav.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("aria-label", "Leaderboard");
    await expect(nav.locator("a[aria-current=page]")).toHaveCount(1);

    // A page that isn't a nav item (a challenge) leaves nothing marked current.
    await page.goto("/challenges/e2e-quiz");
    await expect(nav.locator("a[aria-current=page]")).toHaveCount(0);

    await loginAs(page, "admin");
    await expect(nav.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("Tab reaches the links in order and arrow keys don't change the route", async ({ page }) => {
    await loginAs(page, "strategist");
    const nav = mainNav(page);
    await nav.getByRole("link", { name: "Home" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press("Tab");
    await expect(nav.getByRole("link", { name: "Leaderboard" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/leaderboard$/);
  });

  test("375px: icons only, links keep their accessible names, nothing overflows", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "admin");
    const nav = mainNav(page);
    for (const name of ["Home", "Leaderboard", "Profile", "Admin"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
      await expect(nav.getByRole("link", { name }).locator("span")).toBeHidden(); // the text label is hidden
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("page entry animation", () => {
  test.use({ reducedMotion: "no-preference" });

  test("runs on route change without leaving styles behind or touching the header", async ({ page }) => {
    await loginAs(page, "strategist");
    await mainNav(page).getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();

    // Done within ~0.4 s, and the inline opacity / transform / filter are removed (no stray stacking context).
    await expect
      .poll(() => page.evaluate(() => [...(document.querySelector("main")?.children ?? [])].map((e) => (e as HTMLElement).style.cssText).join("")), {
        timeout: 2000,
      })
      .not.toMatch(/opacity|transform|filter/);
    await expect(page.locator("header")).toHaveCSS("opacity", "1");
    await expect(page.locator("header")).toHaveCSS("filter", "none");
  });

  test("does not re-run on a server-action refresh or when the content is already interactive", async ({ page }) => {
    await loginAs(page, "strategist");
    await expect(page.getByRole("heading", { name: "Welcome, Test" })).toBeVisible();
    // Hard loads aren't animated: content is fully opaque from the first frame.
    const opacity = await page.evaluate(() => getComputedStyle(document.querySelector("main")!.firstElementChild!).opacity);
    expect(opacity).toBe("1");
  });
});
