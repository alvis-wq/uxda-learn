import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(__dirname, "home-view.tsx"), "utf8");
const at = (needle: string) => source.indexOf(needle);

describe("home page layout", () => {
  it("orders the sections: hero, overall progress, categories, required for you", () => {
    const order = ['data-testid="hero"', 'data-testid="overall-progress"', "<CategoryPills", 'data-testid="required-section"'].map(at);
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("has no 'Completed' stat in the hero and no 'All challenges' section", () => {
    expect(source).not.toContain("hero-completed");
    expect(source).not.toContain("All challenges");
  });

  it("uses the shared small, muted section label for every section", () => {
    for (const id of ["overall-heading", "categories-heading", "required-heading"]) {
      expect(source).toMatch(new RegExp(`<SectionLabel id="${id}">`));
    }
  });

  it("puts the category pills directly below the hero and above the required challenges", () => {
    expect(at('data-testid="hero"')).toBeGreaterThan(-1);
    expect(at("<CategoryPills")).toBeGreaterThan(at('data-testid="hero"'));
    expect(at("<CategoryPills")).toBeLessThan(at('data-testid="required-section"'));
  });

  it("has no card section for categories and no 'Coming soon' chips any more", () => {
    expect(source).not.toContain("Coming soon");
    expect(source).not.toContain("comingSoon");
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("CardTitle");
  });

  it("gives a category with no visible challenges no pill", () => {
    expect(source).toMatch(/categories\.filter\(\(c\) => c\.total > 0\)/);
    expect(source).toContain("<CategoryPills categories={withChallenges}");
  });

  it("the page's bottom padding is the glow's reach, so at the end all text sits above the glow", () => {
    expect(source).toContain("paddingBottom: GLOW_CLEARANCE_CSS");
    expect(source).toMatch(/className="mx-auto w-full max-w-5xl px-4 pt-10 sm:pt-16"/); // no fixed pb- class competing with it
  });
});
