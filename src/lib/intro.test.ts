import { describe, expect, it } from "vitest";
import {
  LOADER_BACKSTOP_MS,
  LOADER_FADE_MS,
  LOADER_FADE_REDUCED_MS,
  LOADER_MIN_MS,
  introCookieOnSignIn,
  loaderFadeDelay,
  shouldShowIntro,
} from "./intro";

describe("sign-in intro rules", () => {
  it("queues the intro on the first sign-in of a browser session", () => {
    expect(introCookieOnSignIn(undefined)).toBe("pending");
  });

  it("keeps it queued if it hasn't played yet (signed in twice before it showed)", () => {
    expect(introCookieOnSignIn("pending")).toBe("pending");
  });

  it("doesn't queue it again once it played this browser session", () => {
    expect(introCookieOnSignIn("seen")).toBeNull();
  });

  it("treats unknown cookie values like a missing one", () => {
    expect(introCookieOnSignIn("junk")).toBe("pending");
    expect(shouldShowIntro("junk")).toBe(false);
  });

  it("only shows the intro while it is pending", () => {
    expect(shouldShowIntro("pending")).toBe(true);
    expect(shouldShowIntro("seen")).toBe(false);
    expect(shouldShowIntro(undefined)).toBe(false);
  });

});

describe("post-sign-in loader timing", () => {
  it("has a ~800 ms minimum so it doesn't flash", () => {
    expect(LOADER_MIN_MS).toBe(800);
    expect(loaderFadeDelay(0, true, false)).toBe(800);
    expect(loaderFadeDelay(300, true, false)).toBe(500);
  });

  it("fades straight away once the minimum has passed (no extra wait)", () => {
    expect(loaderFadeDelay(800, true, false)).toBe(0);
    expect(loaderFadeDelay(5000, true, false)).toBe(0);
  });

  it("has no maximum: it never fades while the page isn't ready, however long that takes", () => {
    for (const elapsed of [0, 800, 10_000, 120_000]) expect(loaderFadeDelay(elapsed, false, false)).toBeNull();
    expect(loaderFadeDelay(60_000, false, true)).toBeNull();
  });

  it("with reduced motion has no minimum, only a quick fade", () => {
    expect(loaderFadeDelay(0, true, true)).toBe(0);
    expect(LOADER_FADE_REDUCED_MS).toBeLessThan(LOADER_FADE_MS);
  });

  it("keeps the CSS-only backstop far beyond any normal load", () => {
    expect(LOADER_BACKSTOP_MS).toBeGreaterThanOrEqual(30_000);
  });
});
