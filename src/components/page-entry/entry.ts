import { animate } from "motion/react";

/** Page entry animation: fade in + rise + unblur, staggered over the first few blocks. */
export const ENTRY = {
  duration: 0.3,
  ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
  rise: 8, // px
  blur: 4, // px
  stagger: 0.035, // s between blocks
  maxStaggered: 6, // blocks beyond this appear together with the last staggered one
  reducedDuration: 0.15, // reduced motion: a plain quick fade
};

export function entryDelay(index: number, reduced = false): number {
  if (reduced) return 0;
  return Math.min(index, ENTRY.maxStaggered - 1) * ENTRY.stagger;
}

export type EntryState = { lastPath: string | undefined; clientNavigated: boolean };

/**
 * Decides what a template mount / pathname change should do. The page is server-rendered fully visible and
 * must stay untouched until a client-side route change has really happened:
 *   - first mount (hard load): skip, whatever streams in later is still part of the initial render being hydrated;
 *   - same pathname again (StrictMode re-run, re-render): skip;
 *   - pathname changed after that: play, and from then on content arriving later (a skeleton being replaced) may play too.
 */
export function nextEntryState(prev: EntryState, pathname: string): { state: EntryState; play: boolean } {
  if (prev.lastPath === undefined) return { state: { lastPath: pathname, clientNavigated: false }, play: false };
  if (prev.lastPath === pathname) return { state: prev, play: false };
  return { state: { lastPath: pathname, clientNavigated: true }, play: true };
}

/** A route's real content, as opposed to its loading skeleton (loading.tsx roots are aria-busy). */
export function isContentRoot(el: Element): boolean {
  return el.getAttribute("aria-busy") !== "true" && !el.matches("script, style, template, link");
}

/**
 * The blocks to stagger: a page root with several children animates those children (header, sections,
 * cards), lists contribute their rows; a lone element animates as one block. Hidden ones and anything
 * already below the fold are left alone (nothing to see, nothing to animate).
 */
export function entryItems(roots: Element[]): HTMLElement[] {
  const items: Element[] = [];
  for (const root of roots) {
    const kids = Array.from(root.children).filter(isContentRoot);
    const blocks = kids.length >= 2 ? kids : [root];
    for (const block of blocks) {
      if (block.matches("ul, ol")) items.push(...Array.from(block.children));
      else items.push(block);
    }
  }
  const fold = typeof window === "undefined" ? 0 : window.innerHeight;
  return items.filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.getClientRects().length > 0 && el.getBoundingClientRect().top < fold,
  );
}

const PROPS = ["opacity", "transform", "filter"] as const;

/**
 * Hides the blocks synchronously (call before paint), then animates them in. Uses only opacity,
 * transform and filter, so nothing shifts layout and the content stays clickable throughout.
 * Inline styles are removed afterwards (a leftover `filter` would create a stacking context).
 */
export function playEntry(roots: Element[], reduced: boolean): void {
  const items = entryItems(roots);
  items.forEach((el, i) => {
    el.style.opacity = "0";
    if (!reduced) {
      el.style.transform = `translateY(${ENTRY.rise}px)`;
      el.style.filter = `blur(${ENTRY.blur}px)`;
    }
    const delay = entryDelay(i, reduced);
    const duration = reduced ? ENTRY.reducedDuration : ENTRY.duration;
    const clear = () => PROPS.forEach((p) => el.style.removeProperty(p));
    const controls = animate(
      el,
      reduced
        ? { opacity: [0, 1] }
        : {
            opacity: [0, 1],
            transform: [`translateY(${ENTRY.rise}px)`, "translateY(0px)"],
            filter: [`blur(${ENTRY.blur}px)`, "blur(0px)"],
          },
      { duration, delay, ease: ENTRY.ease },
    );
    controls.then(clear, clear);
    // Backstop: never leave a block hidden if the animation is interrupted or its promise never settles.
    window.setTimeout(clear, (delay + duration) * 1000 + 400);
  });
}
