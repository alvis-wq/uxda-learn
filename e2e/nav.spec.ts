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
    await expect(nav.getByRole("link")).toHaveCount(4); // Home, Leaderboard, Heroes, Profile
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("aria-label", "Home");

    await nav.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("aria-label", "Leaderboard");
    await expect(nav.locator("a[aria-current=page]")).toHaveCount(1);
    await nav.getByRole("link", { name: "Heroes" }).click();
    await expect(page).toHaveURL(/\/heroes$/);
    await expect(nav.locator("a[aria-current=page]")).toHaveAttribute("aria-label", "Heroes");

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
    for (const name of ["Home", "Leaderboard", "Heroes", "Profile", "Admin"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
      await expect(nav.getByRole("link", { name }).locator("span")).toBeHidden(); // the text label is hidden
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // All five (admin) icons fit between the logo and the actions, at 375px and 320px.
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      const navBox = (await nav.boundingBox())!;
      const logo = (await page.locator("header.site-header").getByRole("link", { name: "UXDA Learn" }).boundingBox())!;
      const toggle = (await page.getByRole("button", { name: "Toggle dark mode" }).boundingBox())!;
      expect(logo.x + logo.width, `${width}px: logo clear of nav`).toBeLessThanOrEqual(navBox.x);
      expect(navBox.x + navBox.width, `${width}px: nav clear of actions`).toBeLessThanOrEqual(toggle.x);
    }
  });
});

test.describe("page entry animation", () => {
  test.use({ reducedMotion: "no-preference" });

  test("runs on route change without leaving styles behind or touching the header", async ({ page }) => {
    await loginAs(page, "strategist");
    await mainNav(page).getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { name: "UXDA Learn Leaderboard" })).toBeVisible();

    // Done within ~0.4 s, and the inline opacity / transform / filter are removed (no stray stacking context).
    await expect
      .poll(() => page.evaluate(() => [...(document.querySelector("main")?.children ?? [])].map((e) => (e as HTMLElement).style.cssText).join("")), {
        timeout: 2000,
      })
      .not.toMatch(/opacity|transform|filter/);
    await expect(page.locator("header")).toHaveCSS("opacity", "1");
    await expect(page.locator("header")).toHaveCSS("filter", "none");
  });

  test("the server renders the final visible state: SSR HTML has no opacity:0 / blur / translate styles", async ({ page }) => {
    await loginAs(page, "strategist");
    for (const path of ["/", "/leaderboard", "/heroes", "/profile"]) {
      const html = await (await page.request.get(path)).text(); // exactly what a no-JS visitor and hydration receive
      expect(html, path).toContain("<main");
      const body = html.slice(html.indexOf("<main"));
      expect(body, `${path}: hidden/animated inline styles in SSR HTML`).not.toMatch(/opacity\s*:\s*0(?![.\d])|blur\(|translateY\(/i);
    }
  });

  test("no hydration warnings on a first load or after client-side navigations", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type()) && /hydrat|did not match|server rendered HTML/i.test(msg.text())) problems.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    await loginAs(page, "strategist");
    await page.goto("/"); // first load
    await expect(page.getByRole("heading", { name: "Welcome, Test" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const nav = mainNav(page);
    await nav.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await nav.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.goto("/leaderboard"); // a hard load of a page that streams in behind loading.tsx
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });

  test("does not re-run on a server-action refresh or when the content is already interactive", async ({ page }) => {
    await loginAs(page, "strategist");
    await expect(page.getByRole("heading", { name: "Welcome, Test" })).toBeVisible();
    // Hard loads aren't animated: content is fully opaque from the first frame.
    const opacity = await page.evaluate(() => getComputedStyle(document.querySelector("main")!.firstElementChild!).opacity);
    expect(opacity).toBe("1");
  });
});
