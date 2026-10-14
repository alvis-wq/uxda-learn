import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(__dirname, "home-view.tsx"), "utf8");
const at = (needle: string) => source.indexOf(needle);

describe("home page layout", () => {
  it("orders the sections: hero, overall progress, then the challenge list with its filter", () => {
    const order = ['data-testid="hero"', 'data-testid="overall-progress"', "<HomeChallenges"].map(at);
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("has no 'Completed' stat in the hero and no 'All challenges' section", () => {
    expect(source).not.toContain("hero-completed");
    expect(source).not.toContain("All challenges");
  });

  it("uses the shared small, muted section label for every section", () => {
    expect(source).toMatch(/<SectionLabel id="overall-heading">/);
    const filter = readFileSync(path.resolve(__dirname, "../../components/home-challenges.tsx"), "utf8");
    expect(filter).not.toContain("categories-heading"); // the pills row and its "Categories" label are gone
    for (const id of ["challenges-heading"]) expect(filter).toMatch(new RegExp(`<SectionLabel id="${id}">`));
  });

  it("has no 'Required for you' section or optional-challenges hint any more", () => {
    expect(source).not.toContain("required-section");
    expect(source).not.toContain("Required for you");
    expect(source).not.toContain("optionalHint");
  });

  it("gives a category with no visible challenges no group and no filter option", () => {
    expect(source).toMatch(/categories\.filter\(\(c\) => c\.total > 0\)/);
    expect(source).toContain("categories={withChallenges}");
  });

  it("the page's bottom padding is the glow's reach, so at the end all text sits above the glow", () => {
    expect(source).toContain("paddingBottom: GLOW_CLEARANCE_CSS");
    expect(source).toMatch(/className="mx-auto w-full max-w-5xl px-4 pt-10 sm:pt-16"/); // no fixed pb- class competing with it
  });
});
