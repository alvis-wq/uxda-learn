import { describe, expect, it } from "vitest";
import { INTRO_LEAVE_MS, INTRO_MAX_MS, introCookieOnSignIn, shouldShowIntro } from "./intro";

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

  it("stays within the ~2 s budget", () => {
    expect(INTRO_MAX_MS).toBeLessThanOrEqual(2000);
    expect(INTRO_LEAVE_MS).toBeLessThan(INTRO_MAX_MS);
  });
});
