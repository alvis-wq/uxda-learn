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

describe("fonts", () => {
  const fonts = path.resolve(__dirname, "fonts");

  it("self-hosts Urbanist (Google's latin-ext subset draws the macron of ā ē ī ū one letter to the right)", () => {
    expect(layout).not.toContain("next/font/google");
    expect(layout).toMatch(/localFont\(\{\s*src: "\.\/fonts\/Urbanist-Variable\.woff2"/);
    expect(readdirSync(fonts)).toEqual(expect.arrayContaining(["Urbanist-Variable.woff2", "OFL-Urbanist.txt"]));
  });

  it("supplies only ģ from a second font, which must come first in the stack (Urbanist would build ģ from g + cedilla)", () => {
    expect(layout).toMatch(/Outfit-gcommaaccent\.woff2/);
    expect(layout).toMatch(/declarations: \[\{ prop: "unicode-range", value: "U\+0123" \}\]/);
    expect(layout).toContain("${urbanistGcomma.variable}");
    expect(css).toMatch(/--font-sans: var\(--font-urbanist-extra\), var\(--font-urbanist\)/);
    expect(readdirSync(fonts)).toEqual(expect.arrayContaining(["Outfit-gcommaaccent.woff2", "OFL-Outfit.txt"]));
  });
});
