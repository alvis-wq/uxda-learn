import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STAGE_BACKGROUND } from "@/components/glass-x/constants";

/**
 * WCAG AA contrast for the theme tokens in globals.css, in light and dark mode.
 * Complements the axe checks in e2e/quality.spec.ts, which need a running app + test project.
 */

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`no ${selector} block in globals.css`);
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token] pairs that occur in the UI.
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "muted"], // active tab text sits on bg-background inside bg-muted; inactive on muted
  ["foreground", "accent"], // highlighted leaderboard row
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "popover"],
  ["muted-foreground", "accent"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive-foreground", "destructive"],
  // Scores below 50% and unfinished-content hints.
  ["warning", "background"],
  ["warning", "card"],
  ["warning", "muted"],
  ["warning", "accent"],
];

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s mode tokens", (_mode, selector) => {
  const t = { ...tokens(":root"), ...tokens(selector) };

  it.each(PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined();
    expect(t[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the UXDA accent", () => {
    expect(t.primary.toLowerCase()).toBe("#b5a2ff");
  });
});

describe("softer palette", () => {
  const light = tokens(":root");
  const dark = tokens(".dark");

  it("has no pure white page background in light mode", () => {
    expect(light.background.toLowerCase()).not.toBe("#ffffff");
  });

  it("uses no pure black or white in dark mode", () => {
    for (const v of Object.values(dark)) expect(["#000000", "#ffffff"]).not.toContain(v.toLowerCase());
  });

  it("raises dark surfaces slightly above the background", () => {
    expect(luminance(dark.card)).toBeGreaterThan(luminance(dark.background));
    expect(luminance(dark.popover)).toBeGreaterThan(luminance(dark.background));
  });

  it("layers dark surfaces: background < card < popover, and borders read on both", () => {
    expect(dark.background.toLowerCase()).toBe("#101010");
    expect(luminance(dark.popover)).toBeGreaterThan(luminance(dark.card));
    // Outlines stay calm but visible: floors set just below today's values so layering can't quietly collapse.
    expect(contrast(dark.input, dark.card)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(dark.border, dark.background)).toBeGreaterThanOrEqual(1.3);
    expect(contrast(dark.border, dark.card)).toBeGreaterThanOrEqual(1.15);
  });

  it("keeps the glass X stage the same colour as the dark background", () => {
    expect(STAGE_BACKGROUND.toLowerCase()).toBe(dark.background.toLowerCase());
  });
});
