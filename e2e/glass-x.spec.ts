import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });

const STAGE = "rgb(16, 16, 16)"; // #101010
const FALLBACK = 'img[src*="glass-x.png"]';
const X_CANVAS = "canvas:not(button canvas)"; // the glass X; the sign-in button draws its own small canvas

const card = (page: Page) => page.locator(".stage-card-in");
const intro = (page: Page) => page.getByTestId("sign-in-intro");

/** Sign in through the dev test login; completes onboarding if this user hasn't (the intro follows onboarding). */
async function signIn(page: Page, role: "Strategist" | "Designer" = "Designer") {
  await page.goto("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  const onboard = page.getByRole("button", { name: "Continue" });
  await expect(intro(page).or(onboard)).toBeVisible();
  if (await onboard.isVisible()) {
    await page.getByText(role, { exact: true }).click();
    await onboard.click();
  }
}

test.describe("glass X with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("login: always-dark stage, live X, sign-in usable at once, card fades in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");

    await expect(page.locator("main")).toHaveCSS("background-color", STAGE);
    await expect(page.locator(X_CANVAS)).toHaveCount(1); // the live scene (three loads lazily after idle)

    // Clickable before the card has faded in (returning users shouldn't wait).
    const signInButton = page.getByRole("button", { name: "Sign in with Google" });
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();
    await expect(signInButton.locator("canvas")).toHaveCount(1); // SpecularButton's own light canvas
    await expect(signInButton).toHaveCSS("border-top-width", "0px"); // WebGL draws its edge, no fallback border
    await expect(card(page)).toHaveCSS("opacity", "1", { timeout: 4000 });

    // The page itself never scrolls sideways, also with the canvas.
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("login: no WCAG A/AA violations once the card has faded in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(card(page)).toHaveCSS("opacity", "1", { timeout: 4000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });

  test("login: falls back to the static image without WebGL2, and sign-in still works", async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test double: pretend WebGL2 doesn't exist
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        return type === "webgl2" ? null : getContext.call(this, type, ...rest);
      };
    });
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    const signInButton = page.getByRole("button", { name: "Sign in with Google" });
    await expect(signInButton).toBeEnabled();
    await expect(signInButton).toHaveCSS("border-top-width", "1px"); // visible without WebGL2: the glass edge is drawn by the shader
  });

  test("login: falls back to the static image when the model fails to load", async ({ page }) => {
    await page.route("**/brand/glass_x.glb", (route) => route.abort());
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator(X_CANVAS)).toHaveCount(0); // the failed renderer left nothing behind
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  });

  test("intro: plays after sign-in, is skippable by key, and never repeats this browser session", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page);

    await expect(intro(page)).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === "uxda_intro")?.value).toBe("seen");

    await page.keyboard.press("Space");
    await expect(intro(page)).toBeHidden({ timeout: 1000 });
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Not on reload, and not after signing out and in again within the same browser session.
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(intro(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(intro(page)).toHaveCount(0);
  });

  test("intro: skippable by click, and clears itself within ~2 s when left alone", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page);
    await expect(intro(page)).toBeVisible();
    await page.mouse.click(300, 300);
    await expect(intro(page)).toBeHidden({ timeout: 1000 });

    await page.context().clearCookies();
    await signIn(page);
    await expect(intro(page)).toBeVisible();
    await expect(intro(page)).toBeHidden({ timeout: 3000 }); // ~2 s budget plus page load
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});

test.describe("glass X with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("login: static settled X, card shown at once, no WebGL", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(page.locator(FALLBACK)).toBeVisible();
    await expect(page.locator(X_CANVAS)).toHaveCount(0);
    await expect(card(page)).toHaveCSS("opacity", "1"); // no fade delay
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  });

  test("no intro after sign-in", async ({ page }) => {
    await loginAs(page, "designer"); // reaches the app without waiting for or dismissing anything
    await expect(intro(page)).toBeHidden();
  });
});
