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
