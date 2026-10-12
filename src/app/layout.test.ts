import { readdirSync, readFileSync } from "node:fs";
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

describe("no scrim", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
  const sources = walk(path.resolve(__dirname, "..")).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f));

  it("has no scrim (feathered shadow / backdrop behind text) in any source or stylesheet", () => {
    expect(sources.length).toBeGreaterThan(50);
    const offenders = sources.filter((f) => /\bscrim\b/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
