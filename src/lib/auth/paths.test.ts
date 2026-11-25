import { describe, expect, it } from "vitest";
import { isPublicPath, safeNext } from "./paths";

describe("safeNext", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNext("/challenges/x?y=1")).toBe("/challenges/x?y=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined])(
    "falls back for %s",
    (value) => {
      expect(safeNext(value)).toBe("/");
    },
  );

  // URL parsing drops tabs and newlines and reads "\" as "/", so each of these would resolve to //evil.com.
  it.each(["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\\evil.com", "/\\/evil.com", "/ok\\..\\..//evil.com", "/\u0000/evil.com"])(
    "falls back for a path that hides another host: %j",
    (value) => {
      expect(safeNext(value)).toBe("/");
    },
  );

  it("never returns a path that leaves the origin", () => {
    for (const value of ["/\t/evil.com", "/%09/evil.com", "/a?next=//evil.com", "/a#//evil.com", "/@evil.com", "/:evil.com"]) {
      expect(new URL(safeNext(value), "https://learn.example").origin).toBe("https://learn.example");
    }
  });
});

describe("isPublicPath", () => {
  it("allows login and auth callback/error only", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/auth/error")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/onboarding")).toBe(false);
    expect(isPublicPath("/auth/signout")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});
