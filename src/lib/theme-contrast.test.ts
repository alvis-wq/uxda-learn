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
  ["foreground", "tile"], // challenge cards
  ["muted-foreground", "tile"],
  ["brand-text", "tile"], // the lavender subheading on a challenge card
  ["destructive", "tile"],
  ["warning", "tile"],
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

/** Colour of `fg` drawn at `alpha` opacity over `bg` (the nav labels are dimmed while idle / hovered). */
function blend(fg: string, bg: string, alpha: number): string {
  const ch = (i: number) => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha));
  return `#${[1, 3, 5].map((i) => ch(i).toString(16).padStart(2, "0")).join("")}`;
}

// RubberNav: idle labels are 0.7 opaque, hovered ones 0.9 (RubberNav.css); the active label sits on the thumb.
describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s mode header navigation", (_mode, selector) => {
  const t = { ...tokens(":root"), ...tokens(selector) };

  it.each([0.7, 0.9, 1])("labels at %s opacity meet 4.5:1 on the track", (alpha) => {
    expect(contrast(blend(t["nav-text"], t["nav-track"], alpha), t["nav-track"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the active label meets 4.5:1 on the thumb", () => {
    expect(contrast(t["nav-text-active"], t["nav-thumb"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the thumb stands out from the track", () => {
    expect(contrast(t["nav-thumb"], t["nav-track"])).toBeGreaterThanOrEqual(1.1);
  });

  it("the track is visible against the page", () => {
    expect(contrast(t["nav-track"], t.background)).toBeGreaterThanOrEqual(1.05);
  });
});

// Loading skeletons: neutral greys on the card surface (dark: slightly lighter, light: slightly darker), with a low-contrast
// sweep, and no violet anywhere near them.
describe.each([
  ["light", ":root", -1],
  ["dark", ".dark", 1],
] as const)("%s mode skeletons", (_mode, selector, direction) => {
  const t = { ...tokens(":root"), ...tokens(selector) };
  const shine = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")} \\{[^}]*--skeleton-shine:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\)`));
  const peak = shine ? blend(`#${[1, 2, 3].map((i) => (+shine[i]).toString(16).padStart(2, "0")).join("")}`, t.skeleton, +shine[4]) : t.skeleton;

  it("is a neutral grey", () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(t.skeleton.slice(i, i + 2), 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
  });

  it(`is slightly ${direction > 0 ? "lighter" : "darker"} than the card surface, and still visible on the page`, () => {
    expect(Math.sign(luminance(t.skeleton) - luminance(t.card))).toBe(direction);
    expect(contrast(t.skeleton, t.card)).toBeGreaterThanOrEqual(1.05);
    expect(contrast(t.skeleton, t.background)).toBeGreaterThanOrEqual(1.05);
    expect(contrast(t.skeleton, t.card)).toBeLessThanOrEqual(1.3);
  });

  it("keeps the shimmer highlight low-contrast", () => {
    expect(shine, "--skeleton-shine must be rgb(r g b / a)").not.toBeNull();
    expect(contrast(peak, t.skeleton)).toBeLessThanOrEqual(1.25);
  });
});

// The login glass card sits over the violet glow on the #101010 stage. Composite the CSS values (worst case: the
// glow's centre, with the card's brightest fill on top) and hold the card's text to AA.
describe("login glass card", () => {
  const dark = { ...tokens(":root"), ...tokens(".dark") };
  const rgba = (selector: string, from = 0): { rgb: [number, number, number]; alpha: number } => {
    const block = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? ""; // the top-level rule, not a combined selector
    const m = block.slice(block.indexOf("rgb(", from)).match(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/);
    if (!m) throw new Error(`no rgb() in ${selector}`);
    return { rgb: [+m[1], +m[2], +m[3]], alpha: +m[4] };
  };
  const over = (top: { rgb: number[]; alpha: number }, under: number[]) => top.rgb.map((c, i) => Math.round(c * top.alpha + under[i] * (1 - top.alpha)));
  const hex = (rgb: number[]) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const stage = [0x10, 0x10, 0x10];
  const withGlow = over(rgba(".stage-glow"), stage); // the glow's alpha is its centre value
  const card = hex(over(rgba(".glass-card"), withGlow));

  it.each(["foreground", "card-foreground", "muted-foreground"])("%s meets 4.5:1 on the glass card", (fg) => {
    expect(contrast(dark[fg], card), `${fg} on ${card}`).toBeGreaterThanOrEqual(4.5);
  });

  it("the Google button's text (#f5f5f5) meets 4.5:1 on it", () => {
    expect(contrast("#f5f5f5", card)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("stage glow", () => {
  it("is half its original spread (110vmin / 860px → 55vmin / 430px), same colour and peak intensity", () => {
    expect(css).toMatch(/\.stage-glow \{[^}]*width: min\(55vmin, 430px\);/);
    expect(css).toMatch(/\.stage-glow \{[^}]*radial-gradient\(closest-side, rgb\(128 48 255 \/ 0\.24\), rgb\(89 39 232 \/ 0\.1\) 55%, transparent\)/);
  });

  it("is not part of the post-sign-in loader, which sits on the plain #101010 stage", () => {
    const loader = readFileSync(path.resolve(__dirname, "../components/glass-x/sign-in-loader.tsx"), "utf8");
    expect(loader).not.toMatch(/<div[^>]*stage-glow/);
    expect(loader).toContain("STAGE_BACKGROUND");
    expect(STAGE_BACKGROUND.toLowerCase()).toBe("#101010");
    expect(css).not.toMatch(/\.sign-in-loader[^{]*\{[^}]*(gradient|box-shadow)/);
  });
});

describe("softer palette", () => {
  const light = tokens(":root");
  const dark = tokens(".dark");

  it("has no pure white page background in light mode", () => {
    expect(light.background.toLowerCase()).not.toBe("#ffffff");
  });

  // The one deliberate exception: the active header-nav label is specified as pure white on its thumb.
  const PURE_WHITE_ALLOWED = ["nav-text-active"];

  it("uses no pure black or white in dark mode", () => {
    for (const [name, v] of Object.entries(dark)) {
      if (PURE_WHITE_ALLOWED.includes(name)) continue;
      expect(["#000000", "#ffffff"], `--${name}`).not.toContain(v.toLowerCase());
    }
  });

  it("keeps that exception to the nav label alone", () => {
    expect(PURE_WHITE_ALLOWED).toEqual(["nav-text-active"]);
    expect(dark["nav-text-active"].toLowerCase()).toBe("#ffffff");
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
