import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(path.resolve(__dirname, "layout.tsx"), "utf8");
const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

describe("default theme", () => {
  it("is dark and ignores the system setting; the visitor's own toggle choice is still stored", () => {
    expect(layout).toMatch(/<ThemeProvider[^>]*defaultTheme="dark"/);
    expect(layout).toMatch(/<ThemeProvider[^>]*enableSystem=\{false\}/);
    expect(layout).not.toMatch(/defaultTheme="system"/);
  });

  it("has no styles that follow prefers-color-scheme (they would contradict the saved theme)", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
  });
});

describe("aurora scrim", () => {
  it("backs bare text on the home page with the page colour at ≥ 85% (what AA needs over the visible aurora)", () => {
    const mix = css.match(/\.scrim \{[^}]*color-mix\(in oklab, var\(--background\) (\d+)%, transparent\)/);
    expect(mix, ".scrim rule with a color-mix of --background").not.toBeNull();
    expect(Number(mix![1])).toBeGreaterThanOrEqual(85);
  });
});
