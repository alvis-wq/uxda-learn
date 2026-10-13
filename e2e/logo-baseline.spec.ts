import { expect, test } from "@playwright/test";
import { requireTestProject } from "./project";

requireTestProject();

/**
 * "Learn" stands on the line the logo's letters stand on (the flat bottoms of X, D, A), at any size.
 * A zero-sized inline probe sits on the word's baseline, so its bottom edge IS the baseline; the letters' line is
 * 35.6738/36 of the way down the logo, which the lockup shifts onto the SVG's bottom edge.
 */
for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 800 }]) {
  test(`login card, ${viewport.width}px: the baseline of "Learn" is the bottom of the logo letters`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const gap = await heading.evaluate((h1) => {
      const svg = h1.querySelector("svg")!;
      const word = h1.querySelector("span[aria-hidden]")!;
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0";
      word.appendChild(probe);
      const baseline = probe.getBoundingClientRect().bottom;
      probe.remove();
      const box = svg.getBoundingClientRect(); // includes the lockup's downward shift
      const lettersBottom = box.top + (box.height * 35.6738) / 36; // where the flat letters end, on screen
      return Math.abs(baseline - lettersBottom);
    });
    expect(gap).toBeLessThan(0.5);
  });
}

test("the header lockup keeps one baseline too (desktop, where the word shows)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  const style = await page.locator("h1").evaluate((h1) => {
    const lockup = h1.querySelector("svg")!.parentElement!;
    const word = h1.querySelector("span[aria-hidden]")!;
    return { align: getComputedStyle(lockup).alignItems, lineHeight: getComputedStyle(word).lineHeight };
  });
  expect(style).toEqual({ align: "baseline", lineHeight: "0px" });
});
