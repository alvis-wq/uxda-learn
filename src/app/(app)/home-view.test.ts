import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(__dirname, "home-view.tsx"), "utf8");
const line = (needle: string) => source.split("\n").find((l) => l.includes(needle)) ?? "";

describe("home page: the 'Coming soon' label and chips (over the aurora at the end of the page)", () => {
  it("chips are solid card-coloured pills with a border", () => {
    const chip = line("comingSoon.map") ? source.split("\n")[source.split("\n").findIndex((l) => l.includes("comingSoon.map")) + 1] : "";
    expect(chip).toContain("bg-card");
    expect(chip).toContain("rounded-full");
    expect(chip).toContain("border");
  });

  it("the label uses the full foreground colour, not muted", () => {
    const label = line('id="soon-heading"');
    expect(label).toContain("text-foreground");
    expect(label).not.toContain("text-muted-foreground");
  });

  it("the page's bottom padding is the glow's reach, so at the end all text sits above the glow", () => {
    expect(source).toContain("paddingBottom: GLOW_CLEARANCE_CSS");
    expect(source).toMatch(/className="mx-auto w-full max-w-5xl px-4 pt-10 sm:pt-16"/); // no fixed pb- class competing with it
  });
});
