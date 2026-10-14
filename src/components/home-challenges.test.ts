import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const list = read("home-challenges.tsx");
const menu = read("filter-menu.tsx");
const card = read("challenge-card.tsx");

describe("home filter (source rules)", () => {
  it("filters on the client: the URL changes through history.pushState, never through the router (no navigation or fetch)", () => {
    expect(list).toContain("window.history.pushState");
    expect(list).not.toMatch(/useRouter|router\.(push|replace)|redirect\(/);
    expect(list).toContain("useSearchParams");
  });

  it("respects reduced motion: the list's fade-in and the button's colour transition switch off", () => {
    expect(list).toContain("motion-reduce:animate-none");
    expect(menu).toContain("motion-reduce:transition-none");
  });

  it("is a real menu: Radix DropdownMenu with radio items (keyboard, Escape and focus return come with it), named for screen readers", () => {
    expect(menu).toContain('from "radix-ui"');
    expect(menu).toContain("DropdownMenu.RadioGroup");
    expect(menu).toContain("DropdownMenu.RadioItem");
    expect(menu).toContain('aria-label="Filter challenges"');
    expect(menu).toContain("sr-only");
  });

  it("the button names the active filter", () => {
    expect(menu).toContain("Filter: {active.label}");
  });

  it("the drafts option exists only for testers, and drafts are never grouped under All", () => {
    expect(list).toContain("...(tester ? [{ key: DRAFTS_FILTER");
    expect(list).toContain("groupByCategory(challenges, categories)"); // `challenges` never holds drafts (learner.ts)
    expect(list).not.toMatch(/groupByCategory\([^)]*drafts/);
  });

  it("a chosen filter shows only its group, without the group label", () => {
    // The label (h3) is rendered only in the All branch.
    const labelAt = list.indexOf("<h3");
    expect(labelAt).toBeGreaterThan(list.indexOf("selected === ALL_CATEGORIES"));
    expect(list.slice(list.indexOf("selected === DRAFTS_FILTER ? (")).includes("<h3")).toBe(false);
  });

  it("draft cards have a dashed border and a muted surface", () => {
    expect(card).toContain("border-dashed");
    expect(card).toContain("bg-muted");
    expect(card).toContain("<DraftBadge />");
  });
});
