import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_LETTER_BASE } from "./uxda-logo";

const read = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8");

describe("logo lockup baseline", () => {
  it("the letters' flat bottoms are read off the logo's own paths: 35.6738 of the 36-tall viewBox", () => {
    const svg = read("uxda-logo.tsx");
    expect(svg).toContain('viewBox="0 0 189 36"');
    expect(svg).toContain("35.6738"); // the X, D and A feet
    expect(LOGO_LETTER_BASE).toBeCloseTo(35.6738 / 36, 6);
    expect(LOGO_LETTER_BASE).toBeLessThan(1); // the U overshoots below it
  });

  it("aligns by font metrics, not by a pixel nudge: baseline alignment, a zero-height word, a percentage offset of the logo", () => {
    const lockup = read("uxda-lockup.tsx");
    expect(lockup).toContain("items-baseline");
    expect(lockup).toContain("leading-[0]");
    expect(lockup).toMatch(/translateY\(\$\{.*\}%\)/); // a percentage is relative to the logo's own height
    expect(lockup).not.toMatch(/translateY\(-?\d+(\.\d+)?px\)|mt-\[|-mb-\[|top-\[\d+px\]/);
  });

  it("the header and the login card both use the lockup", () => {
    expect(read("site-header.tsx")).toContain("<UxdaLockup");
    expect(read("../app/login/page.tsx")).toContain("<UxdaLockup");
  });
});
