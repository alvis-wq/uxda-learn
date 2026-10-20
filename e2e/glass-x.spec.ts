import AxeBuilder from "@axe-core/playwright";
import { LOGIN_SOUND_DURATION_S } from "../src/lib/login-sound";
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

  test("login: plays every time the page loads: fresh visit, reload, after sign-out", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 5000 });

    // A reload plays it again (nothing remembers that it already played)...
    await page.reload();
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await expect(cardWrap(page)).toHaveCSS("opacity", "0");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 5000 });

    // ...and so does skipping it: a click ends it, the next load still plays.
    await page.reload();
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await page.mouse.click(300, 300);
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 1000 });
    await page.reload();
    await expect(stage(page)).toHaveAttribute("data-seq", "play");

    // No cookie or storage for it.
    expect((await page.context().cookies()).some((c) => c.name === "uxda_login_seq")).toBe(false);
  });

  test("login: plays again after signing out", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page);
    await expect(loader(page)).toBeHidden({ timeout: 15_000 });
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(stage(page)).toHaveAttribute("data-seq", "play");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
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

/** A fake <audio> playback, so the tests are deterministic and silent: records every play (with its position) and pause (with its volume). */
async function stubAudio(page: Page, { blocked = false }: { blocked?: boolean } = {}) {
  await page.addInitScript((block) => {
    const record = { plays: [] as number[], pauseVolumes: [] as number[], windowPointerDowns: 0 };
    (window as unknown as { __audio: typeof record }).__audio = record;
    // Pointer events that reach the window are what skip the sequence; the toggle must not let its own through.
    window.addEventListener("pointerdown", () => record.windowPointerDowns++);
    const state = new WeakMap<HTMLMediaElement, boolean>();
    Object.defineProperty(HTMLMediaElement.prototype, "paused", { get() { return !state.get(this); } });
    HTMLMediaElement.prototype.play = function () {
      record.plays.push(this.currentTime);
      if (block) return Promise.reject(new DOMException("play() failed: no user gesture", "NotAllowedError"));
      state.set(this, true);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      record.pauseVolumes.push(this.volume);
      state.set(this, false);
    };
  }, blocked);
}
const audioLog = (page: Page) => page.evaluate(() => (window as unknown as { __audio: { plays: number[]; pauseVolumes: number[]; windowPointerDowns: number } }).__audio);
const soundToggle = (page: Page) => page.getByRole("button", { name: "Sound on/off" });
/** A real pointer click on the toggle, without waiting for "actionability" (the X is rendering, and that wait can outlast the sequence). */
async function tapSoundToggle(page: Page) {
  const box = (await soundToggle(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
/** Start the page with a saved choice, set once per tab (an init script runs on every load, and must not undo a later toggle). */
const rememberSound = (page: Page, value: "on" | "off") =>
  page.addInitScript((v) => {
    if (sessionStorage.getItem("test-seeded-sound")) return;
    sessionStorage.setItem("test-seeded-sound", "1");
    localStorage.setItem("uxda:login-sound", v);
  }, value);

test.describe("login intro sound (motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("off by default: a labelled toggle in the corner, nothing plays, nothing preloaded or stored", async ({ page }) => {
    await stubAudio(page);
    await page.context().clearCookies();
    await page.goto("/login");
    const toggle = soundToggle(page);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const box = (await toggle.boundingBox())!;
    expect(box.x).toBeGreaterThan(page.viewportSize()!.width - 100); // top-right corner
    expect(box.y).toBeLessThan(80);
    await expect(page.locator("audio")).toHaveAttribute("preload", "none");
    await expect(page.locator("audio")).toHaveAttribute("src", "/brand/login-intro.mp3");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 7000 });
    expect((await audioLog(page)).plays).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("uxda:login-sound"))).toBeNull();
  });

  test("on: plays when the sequence starts (preload auto); the choice is remembered across reloads", async ({ page }) => {
    await stubAudio(page);
    await rememberSound(page, "on");
    await page.goto("/login");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await expect(page.locator("audio")).toHaveAttribute("preload", "auto");
    await expect(toggleOn(page)).toBeVisible();
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    expect((await audioLog(page)).plays[0]).toBe(0); // from the start of the sequence
    await page.reload();
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1); // plays again on every load
  });

  test("turning it on mid-sequence starts from the sequence's position and does not skip the sequence", async ({ page }) => {
    await stubAudio(page);
    await page.goto("/login");
    await expect(page.locator(X_CANVAS)).toHaveCount(1);
    await tapSoundToggle(page);
    // Clicking the toggle is not the "click skips" gesture: its pointer event never reaches the window.
    expect((await audioLog(page)).windowPointerDowns).toBe(0);
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    const [position] = (await audioLog(page)).plays;
    expect(position).toBeGreaterThan(0); // from where the sequence has got to, not from 0
    expect(position).toBeLessThan(LOGIN_SOUND_DURATION_S);
    expect(await page.evaluate(() => localStorage.getItem("uxda:login-sound"))).toBe("on");
    await expect(page.locator("audio")).toHaveAttribute("preload", "auto");
  });

  test("turning it off stops it (faded) and it never plays again", async ({ page }) => {
    await stubAudio(page);
    await rememberSound(page, "on");
    await page.goto("/login");
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    await tapSoundToggle(page);
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(async () => (await audioLog(page)).pauseVolumes.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => localStorage.getItem("uxda:login-sound"))).toBe("off");
    await page.reload();
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 7000 });
    expect((await audioLog(page)).plays).toEqual([]);
  });

  test("a click or key skips the sequence and the sound fades out (it is silent before it stops)", async ({ page }) => {
    await stubAudio(page);
    await rememberSound(page, "on");
    await page.goto("/login");
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    await page.keyboard.press("x");
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 1500 });
    await expect.poll(async () => (await audioLog(page)).pauseVolumes.length, { timeout: 4000 }).toBeGreaterThan(0);
    expect((await audioLog(page)).pauseVolumes.at(-1)!).toBeLessThanOrEqual(0.05); // faded to silence, then stopped
  });

  test("blocked autoplay fails silently: no errors, no console output", async ({ page }) => {
    await stubAudio(page, { blocked: true });
    await rememberSound(page, "on");
    const noise: string[] = [];
    page.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type()) && !/GL Driver/.test(m.text())) noise.push(`${m.type()}: ${m.text().slice(0, 120)}`);
    });
    await page.goto("/login");
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    await expect(stage(page)).toHaveAttribute("data-seq", "done", { timeout: 7000 });
    expect(noise).toEqual([]);
  });
});

const toggleOn = (page: Page) => soundToggle(page).and(page.locator('[aria-pressed="true"]'));

test.describe("post-sign-in loader (motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("shows after every new sign-in, fades when the page is ready, and not on reloads or navigation", async ({ page }) => {
    const introCookie = async () => (await page.context().cookies()).find((c) => c.name === "uxda_intro")?.value;
    await page.context().clearCookies();
    await signIn(page);

    await expect(loader(page)).toBeVisible();
    expect(await introCookie()).toBe("seen");
    // The X sits on plain #101010: no glow or gradient behind it.
    await expect(loader(page)).toHaveCSS("background-color", STAGE);
    await expect(loader(page)).toHaveCSS("background-image", "none");
    await expect(loader(page).locator(".stage-glow")).toHaveCount(0);
    // Real loader: gone once the app's first page is ready (no fixed length), but not before its ~0.8 s minimum.
    const shownAt = Date.now();
    await expect(loader(page)).toBeHidden({ timeout: 15_000 });
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(600);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Not on reload, and not when navigating inside the app.
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Heroes" }).first().click();
    await expect(page).toHaveURL(/\/heroes/);
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(loader(page)).toHaveCount(0);

    // Signing out clears the "already shown" state; signing in again is a new sign-in and shows the loader again.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await introCookie()).toBeUndefined();
    await signIn(page);
    await expect(loader(page)).toBeVisible();
    expect(await introCookie()).toBe("seen");
    await expect(loader(page)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
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

  test("login sound: none unless the toggle is on; on, it plays at once (there is no sequence)", async ({ page }) => {
    await stubAudio(page);
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(stage(page)).toHaveAttribute("data-seq", "done");
    await page.waitForTimeout(500);
    expect((await audioLog(page)).plays).toEqual([]);

    await tapSoundToggle(page);
    await expect.poll(async () => (await audioLog(page)).plays.length).toBe(1);
    await tapSoundToggle(page);
    await expect.poll(async () => (await audioLog(page)).pauseVolumes.length).toBeGreaterThan(0);
  });

  test("post-sign-in loader: no X and a plain quick fade", async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page, "designer"); // clicks and waits through whatever overlay there is
    await expect(loader(page)).toBeHidden({ timeout: 5000 });
    await expect(loader(page).locator("canvas, img")).toHaveCount(0);
  });
});
