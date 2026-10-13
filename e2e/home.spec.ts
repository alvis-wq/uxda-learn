import { expect, test } from "@playwright/test";
import { auroraBoxHeight, visibleGlowHeight } from "../src/components/aurora/geometry";
import { cleanTestUserData } from "./fixtures";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

test.describe("home page", () => {
  test("hero greets by first name and the page has no hydration problems", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type()) && /hydrat|did not match|server rendered HTML/i.test(msg.text())) problems.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    await loginAs(page, "designer");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Test" })).toBeVisible();
    await expect(page.getByTestId("hero-points")).toBeVisible();
    await expect(page.getByTestId("hero-rank")).toBeVisible();
    await expect(page.getByTestId("hero-completed")).toHaveCount(0); // the "Completed" stat moved into Overall progress
    await expect(page.getByTestId("overall-count")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });

  test("aurora is fixed to the bottom of the viewport, behind everything, decorative and not interactive", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 }); // short, so the page scrolls
    await loginAs(page, "designer");
    await page.goto("/");
    const aurora = page.getByTestId("aurora");
    await expect(aurora).toBeAttached();
    await expect(aurora).toHaveAttribute("aria-hidden", "true");
    await expect(aurora).toHaveCSS("pointer-events", "none");
    await expect(aurora).toHaveCSS("position", "fixed");
    await expect(aurora).toHaveCSS("z-index", "-10");
    // Portalled into <body>, so no transformed ancestor (the page-entry animation) can trap the fixed positioning.
    expect(await aurora.evaluate((el) => el.parentElement === document.body)).toBe(true);

    // Its glow's middle line (0.115 of the box height up from the box's bottom edge) sits on the viewport's bottom edge.
    const geometry = () => aurora.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { belowBottom: r.bottom - innerHeight, height: r.height, top: r.top };
    });
    const before = await geometry();
    expect(before.belowBottom / before.height).toBeCloseTo(0.115, 2);

    // It stays put while scrolling.
    await page.evaluate(() => window.scrollTo(0, 600));
    expect(await geometry()).toEqual(before);

    // Content paints above it and stays clickable.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId("hero-rank").getByRole("link", { name: /hidden from the leaderboard/ })).toBeVisible();
    await page.getByTestId("hero-rank").getByRole("link", { name: /hidden from the leaderboard/ }).click();
    await expect(page).toHaveURL(/\/profile$/);
    // ...and it is a home-page thing only.
    await expect(page.getByTestId("aurora")).toHaveCount(0);
  });

  test("the aurora is half as tall as before, and scrolled to the end all text sits above the glow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "designer");
    await page.goto("/");
    const box = await page.getByTestId("aurora").evaluate((el) => el.getBoundingClientRect().height);
    expect(box).toBeCloseTo(auroraBoxHeight(800)); // 300px (it was 600px)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lowestText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
      let bottom = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) bottom = Math.max(bottom, r.bottom);
      }
      return bottom;
    });
    // The glow lights the viewport from its bottom edge up to visibleGlowHeight(box); the text ends above that.
    expect(lowestText).toBeLessThanOrEqual(800 - visibleGlowHeight(box));
  });

  test("without WebGL2 there is no aurora drawn and nothing breaks", async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test double: pretend WebGL2 doesn't exist
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        return type === "webgl2" ? null : getContext.call(this, type, ...rest);
      };
    });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await loginAs(page, "designer");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Test" })).toBeVisible();
    await expect(page.getByTestId("challenges-section")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the header is sticky: transparent at the top, translucent with blur once content scrolls under it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 360 }); // short, so the page can scroll
    await loginAs(page, "designer");
    await page.goto("/");
    const header = page.locator("header.site-header");
    await expect(header).toHaveCSS("position", "sticky");
    await expect(header).not.toHaveAttribute("data-scrolled", "");
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(header).toHaveCSS("backdrop-filter", "none");

    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveAttribute("data-scrolled", "");
    await expect(header).toHaveCSS("backdrop-filter", /blur/);
    await expect(header).not.toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
    expect((await header.boundingBox())!.y).toBe(0); // still stuck to the top

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveAttribute("data-scrolled", "");
  });

  test("header: full viewport width, logo far left, actions far right, nav in the true centre of the viewport", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/");
    const box = async (loc: ReturnType<typeof page.locator>) => (await loc.boundingBox())!;
    const header = page.locator("header.site-header");
    const geometry = async () => {
      const width = page.viewportSize()!.width;
      return {
        width,
        header: await box(header),
        logo: await box(header.getByRole("link", { name: "UXDA Learn" })),
        nav: await box(page.getByRole("navigation", { name: "Main" })),
        toggle: await box(page.getByRole("button", { name: "Toggle dark mode" })),
        signOut: await box(page.getByRole("button", { name: "Sign out" })),
      };
    };

    // Desktop: ~80px side padding, header as wide as the viewport (the page content below keeps its max-width).
    let g = await geometry();
    expect(g.header.width).toBe(g.width);
    expect(g.logo.x).toBeCloseTo(80, 0);
    expect(g.width - (g.signOut.x + g.signOut.width)).toBeCloseTo(80, 0);
    expect(g.nav.x + g.nav.width / 2).toBeCloseTo(g.width / 2, 0); // true centre, not between logo and actions
    // The page content keeps its container width; only the header is full width.
    expect(await page.locator("main > div").first().evaluate((el) => getComputedStyle(el).maxWidth)).toBe("1024px");

    // Tablet and phone: side padding scales down, the nav stays centred, nothing overlaps or overflows.
    for (const [width, padding] of [[1024, 80], [768, 40], [375, 16]] as const) {
      await page.setViewportSize({ width, height: 800 });
      g = await geometry();
      expect(g.logo.x, `${width}px: left padding`).toBeCloseTo(padding, 0);
      expect(g.nav.x + g.nav.width / 2, `${width}px: nav centred`).toBeCloseTo(width / 2, 0);
      expect(g.logo.x + g.logo.width, `${width}px: logo clear of nav`).toBeLessThanOrEqual(g.nav.x);
      expect(g.nav.x + g.nav.width, `${width}px: nav clear of actions`).toBeLessThanOrEqual(g.toggle.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    }
    // Below 1024px the nav is icon-only (its links keep their accessible names).
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Leaderboard" }).locator("span")).toBeHidden();
  });

  test("required challenges and categories are cards: Start CTA, meta row, one link per card", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/categories/e2e-tests");
    const cards = page.getByTestId("challenge-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    const quiz = cards.filter({ has: page.getByRole("link", { name: "[E2E] Quiz" }) });
    await expect(quiz).toContainText("Start");
    await expect(quiz).toContainText("10 pts");
    await expect(quiz.getByRole("link")).toHaveCount(1); // the whole card is one link, named by the title
    // The meta is always two rows: what it is (type, difficulty, points, time), then where the learner stands.
    const meta = quiz.getByTestId("card-meta");
    const [row1, row2] = [meta.locator("> div").nth(0), meta.getByTestId("card-badges")];
    await expect(row1).toContainText("10 pts");
    await expect(row2).toContainText("Not started");
    const tops = await row1.locator("> *").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)));
    expect(new Set(tops).size).toBe(1); // row 1 never wraps
    expect((await row2.boundingBox())!.y).toBeGreaterThan((await row1.boundingBox())!.y + (await row1.boundingBox())!.height - 1);
    await expect(quiz).toHaveCSS("border-top-left-radius", /^(24|32)px$/);
    // No artwork configured for the fixtures: no image, text uses the full card.
    await expect(quiz.locator("img")).toHaveCount(0);
    await quiz.getByRole("link").click();
    await expect(page).toHaveURL(/\/challenges\/e2e-quiz$/);
  });
});

test.describe("theme", () => {
  test.use({ colorScheme: "light" }); // a light system setting must not matter

  test("dark by default for a visitor with no saved choice; the toggle works and is remembered", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(16, 16, 16)"); // #101010

    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/); // remembered

    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  });

  test("Categories and Challenges come right after Overall progress; the pills are 36px tall with count and name", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/");
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
    const [hero, overall, pills, list] = [await box("hero"), await box("overall-progress"), await box("category-pills"), await box("challenges-section")];
    expect(overall.y).toBeGreaterThanOrEqual(hero.y + hero.height);
    expect(pills.y).toBeGreaterThanOrEqual(overall.y + overall.height);
    expect(list.y).toBeGreaterThanOrEqual(pills.y + pills.height);
    await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible();
    await expect(page.getByText("Required for you")).toHaveCount(0);
    await expect(page.getByTestId("optional-hint")).toHaveCount(0);
    await expect(page.getByText("Coming soon")).toHaveCount(0);

    // "All" comes first, with the overall count; then one pill per category with a visible challenge.
    const all = page.getByTestId("category-pill").first();
    await expect(all).toHaveAttribute("data-slug", "all");
    await expect(all).toHaveAttribute("data-active", "");
    await expect(all).toContainText("All");
    await expect(all.locator("[aria-hidden]").first()).toContainText(/\d+\/\d+/);
    const pill = page.getByTestId("category-pill").filter({ hasText: "[E2E] Test challenges" });
    await expect(pill).toContainText("completed");
    expect((await pill.boundingBox())!.height).toBe(36);
    await pill.focus();
    await expect(pill).toHaveCSS("box-shadow", /0px 0px 0px 3px/); // visible keyboard focus
  });

  test("a pill filters the list in place: URL, no page load, back/forward, reload, shared link", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/");
    const titles = () => page.getByTestId("challenge-card").locator("h3").allInnerTexts();
    const all = await titles();
    expect(all.length).toBeGreaterThanOrEqual(2);
    // The order: required and overdue first, the rest not started after it.
    expect(all[0]).toContain("[E2E] Read the rules");

    const loads: string[] = [];
    page.on("request", (request) => request.resourceType() === "document" && loads.push(request.url()));
    await page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true));
    const pill = page.getByTestId("category-pill").filter({ hasText: "[E2E] Test challenges" });
    await pill.click();
    await expect(page).toHaveURL(/\/\?category=e2e-tests$/);
    await expect(pill).toHaveAttribute("data-active", "");
    await expect(pill).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("category-pill").first()).not.toHaveAttribute("data-active", "");
    expect(await titles()).toEqual(all); // every fixture challenge is in this category: same list, same order
    await expect(page.getByTestId("filter-status")).toContainText("[E2E] Test challenges");
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true); // same document
    expect(loads).toEqual([]);

    await page.getByTestId("category-pill").first().click(); // All: the param goes away
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\?category=e2e-tests$/);
    await expect(pill).toHaveAttribute("data-active", "");
    await page.goForward();
    await expect(page).toHaveURL(/\/$/);

    // A shared link and a reload keep the filter; an unknown category means All.
    await page.goto("/?category=e2e-tests");
    await expect(pill).toHaveAttribute("data-active", "");
    await page.reload();
    await expect(pill).toHaveAttribute("data-active", "");
    await page.goto("/?category=nope");
    await expect(page.getByTestId("category-pill").first()).toHaveAttribute("data-active", "");
    expect(await titles()).toEqual(all);
  });

  test("the pill row scrolls sideways on a phone without making the page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await loginAs(page, "designer");
    await page.goto("/");
    await expect(page.getByTestId("category-pills")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const list = page.getByTestId("category-pills").locator("ul");
    await expect(list).toHaveCSS("overflow-x", "auto");
    await expect(list).toHaveCSS("flex-wrap", "nowrap");
  });

  test("with reduced motion the list does not animate when the filter changes", async ({ page }) => {
    await loginAs(page, "designer"); // the suite runs with reduced motion on
    await page.goto("/");
    await page.getByTestId("category-pill").filter({ hasText: "[E2E] Test challenges" }).click();
    await expect(page.getByTestId("challenge-list")).toHaveCSS("animation-name", "none");
  });
});
