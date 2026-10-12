import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });

const STAGE = "rgb(16, 16, 16)"; // #101010
const X_CANVAS = "canvas:not(button canvas)"; // the glass X; the sign-in button draws its own small canvas
const SIGN_IN = "Sign in with Google";

const stage = (page: Page) => page.locator(".login-stage");
const cardWrap = (page: Page) => page.locator(".login-card-wrap");
const loader = (page: Page) => page.getByTestId("sign-in-loader");

/** Sign in through the dev test login; completes onboarding if this user hasn't (the loader follows onboarding). */
async function signIn(page: Page, role: "Strategist" | "Designer" = "Designer") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click(); // waits for the card to be clickable
  const onboard = page.getByRole("button", { name: "Continue" });
  await expect(loader(page).or(onboard)).toBeVisible();
  if (await onboard.isVisible()) {
    await page.getByText(role, { exact: true }).click();
    await onboard.click();
  }
}

test.describe("login sequence (motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("login: the X plays, the glass card fades in over it, then the X is gone and its scene freed", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");

    await expect(stage(page)).toHaveCSS("background-color", STAGE);
    // The card is in the DOM from the start (reachable by screen readers) but hidden, not clickable, not tabbable.
    await expect(page.getByRole("heading", { name: "UXDA Learn" })).toBeAttached();
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await expect(cardWrap(page)).toHaveCSS("opacity", "0");
    await expect(cardWrap(page)).toHaveCSS("pointer-events", "none");
    const button = page.getByRole("button", { name: SIGN_IN });
    await expect(button).toHaveAttribute("tabindex", "-1");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);

    // ~1.8 s after the X is ready the card is visible, clickable and focusable.
    await expect(stage(page)).toHaveAttribute("data-seq", /card|out/, { timeout: 4000 });
    await expect(cardWrap(page)).toHaveCSS("opacity", "1", { timeout: 2000 });
    await expect(cardWrap(page)).toHaveCSS("pointer-events", "auto");
    await expect(button).not.toHaveAttribute("tabindex", "-1");

    // ~2.9 s: end state, the X's canvas is removed (rendering stopped, GPU released).
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 5000 });
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    await expect(button).toBeEnabled();
  });

  test("login: no WCAG A/AA violations in the end state", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 6000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

    // The page never scrolls sideways at 375px, with the card in its end state.
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("login: a click or any key jumps to the end state", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await expect(page.locator(X_CANVAS)).toHaveCount(1); // the page has hydrated and the X is up
    await page.keyboard.press("Space");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 1000 });
    await expect(cardWrap(page)).toHaveCSS("opacity", "1");
    await expect(page.locator(X_CANVAS)).toHaveCount(0);

    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await page.mouse.click(300, 300);
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 1000 });
  });

  test("login: plays once per browser session; later visits go straight to the end state", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await page.goto("/login"); // same session: the cookie says it has played
    await expect(stage(page)).toHaveAttribute("data-seq", "done");
    await expect(cardWrap(page)).toHaveCSS("opacity", "1");
    await page.waitForTimeout(500);
    await expect(page.locator(X_CANVAS)).toHaveCount(0); // the scene never even starts
  });

  test("login: skips to the card without WebGL2, and sign-in still works", async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test double: pretend WebGL2 doesn't exist
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        return type === "webgl2" ? null : getContext.call(this, type, ...rest);
      };
    });
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 1500 });
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    const button = page.getByRole("button", { name: SIGN_IN });
    await expect(button).toBeEnabled();
    await expect(button).toHaveCSS("border-top-width", "1px"); // the SpecularButton's visible fallback border
  });

  test("login: skips to the card when the model fails to load", async ({ page }) => {
    await page.route("**/brand/glass_x.glb", (route) => route.abort());
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 3000 });
    await expect(page.locator(X_CANVAS)).toHaveCount(0); // the failed renderer left nothing behind
    await expect(page.getByRole("button", { name: SIGN_IN })).toBeEnabled();
  });

  test("login: skips to the card when the model takes longer than ~1 s", async ({ page }) => {
    await page.route("**/brand/glass_x.glb", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 2500 });
    await page.waitForTimeout(3500); // the late model must not start anything
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    await expect(cardWrap(page)).toHaveCSS("opacity", "1");
  });
});

test.describe("post-sign-in loader (motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("shows after sign-in, fades when the page is ready, is skippable, and never repeats this browser session", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page);

    await expect(loader(page)).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === "uxda_intro")?.value).toBe("seen");
    // Real loader: gone once the app's first page is ready (no fixed length), but not before its ~0.8 s minimum.
    const shownAt = Date.now();
    await expect(loader(page)).toBeHidden({ timeout: 15_000 });
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(600);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Not on reload, and not after signing out and in again within the same browser session.
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
  });

  test("a key skips it", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page);
    await expect(loader(page)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(loader(page)).toBeHidden({ timeout: 1500 });
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("login: card shown at once, no X, no sequence", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done");
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    await expect(cardWrap(page)).toHaveCSS("opacity", "1");
    await expect(page.getByRole("button", { name: SIGN_IN })).toBeEnabled();
  });

  test("post-sign-in loader: no X and a plain quick fade", async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page, "designer"); // clicks and waits through whatever overlay there is
    await expect(loader(page)).toBeHidden({ timeout: 5000 });
    await expect(loader(page).locator("canvas, img")).toHaveCount(0);
  });
});
