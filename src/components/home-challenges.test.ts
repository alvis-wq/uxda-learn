import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const list = read("home-challenges.tsx");
const pills = read("category-pills.tsx");

describe("home category filter (source rules)", () => {
  it("filters on the client: the URL changes through history.pushState, never through the router (no navigation or fetch)", () => {
    expect(list).toContain("window.history.pushState");
    expect(list).not.toMatch(/useRouter|router\.(push|replace)|redirect\(/);
    expect(list).toContain("useSearchParams");
  });

  it("respects reduced motion: the list's fade-in and the pills' colour transition switch off", () => {
    expect(list).toContain("motion-reduce:animate-none");
    expect(pills).toContain("motion-reduce:transition-none");
  });

  it("pills are real links with the filter in their href, and modified clicks are left to the browser", () => {
    expect(pills).toContain("<a");
    expect(pills).toContain("href={hrefFor(c.key)}");
    expect(pills).toMatch(/metaKey \|\| event\.ctrlKey/);
    expect(pills).toContain('aria-current={active ? "true" : undefined}');
  });

  it("the selected pill is filled like the active nav item (the nav's thumb tokens)", () => {
    expect(pills).toContain("bg-[var(--nav-thumb)]");
    expect(pills).toContain("text-[var(--nav-text-active)]");
    expect(pills).toContain("bg-[var(--nav-track)]");
  });
});
