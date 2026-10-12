import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.resolve(__dirname, "home-view.tsx"), "utf8");
const line = (needle: string) => source.split("\n").find((l) => l.includes(needle)) ?? "";

describe("home page: the 'Coming soon' label and chips (over the aurora at the end of the page)", () => {
  it("chips are solid card-coloured pills with a border, not scrimmed", () => {
    const chip = line("comingSoon.map") ? source.split("\n")[source.split("\n").findIndex((l) => l.includes("comingSoon.map")) + 1] : "";
    expect(chip).toContain("bg-card");
    expect(chip).toContain("rounded-full");
    expect(chip).toContain("border");
    expect(chip).not.toContain("scrim");
  });

  it("the label uses the full foreground colour, not muted, and no scrim", () => {
    const label = line('id="soon-heading"');
    expect(label).toContain("text-foreground");
    expect(label).not.toContain("text-muted-foreground");
    expect(label).not.toContain("scrim");
  });

  it("the page keeps bottom padding so the last text clears the glow at the end of the page", () => {
    expect(source).toMatch(/max-w-5xl px-4 pt-10 pb-28/);
  });
});
