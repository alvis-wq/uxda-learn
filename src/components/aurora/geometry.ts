/**
 * Geometry of the home page's aurora, shared by the component, the home page's bottom padding and the tests.
 *
 * With `direction="bottom"` the shader's glow is brightest at the *box's* bottom edge and fades upwards, so
 * "the middle of the aurora" is the middle of that band (the line with equal light above and below it). Measured
 * from rendered frames (600-900px boxes, 1280-1920px wide, dark and light): 0.10-0.13 of the box height up from its
 * bottom edge, stable over time. That line sits on the viewport's bottom edge, so the box overhangs by this much.
 */
export const GLOW_MIDLINE = 0.115;

/**
 * How far up the glow is still visibly lit (the faintest wisp, 4+ levels off the page colour), as a fraction of the
 * box height from the box's bottom edge. Measured from rendered frames at 300-450px boxes, 375-1920px wide, 6 moments:
 * dark 0.47-0.48, light 0.35-0.37 (the larger, dark value is used). Proportional to the box height.
 */
export const GLOW_REACH = 0.48;

/** The box height: clamp(300px, 37.5vh, 450px) — half of the previous 600-900px, so the glow rises half as high. */
export const AURORA_BOX = { min: 300, vh: 37.5, max: 450 } as const;

export const auroraBoxHeight = (viewportHeight: number) =>
  Math.min(AURORA_BOX.max, Math.max(AURORA_BOX.min, (AURORA_BOX.vh / 100) * viewportHeight));

/** Pixels of the viewport, from its bottom edge up, that the glow can light (only the upper half shows). */
export const visibleGlowHeight = (boxHeight: number) => (GLOW_REACH - GLOW_MIDLINE) * boxHeight;

/** The tallest the visible glow gets (the box at its largest). */
export const MAX_VISIBLE_GLOW = visibleGlowHeight(AURORA_BOX.max);

/** Space the home page keeps below its last line so, scrolled to the end, all text sits above the glow (plus 1rem). */
export const GLOW_CLEARANCE_CSS = `calc(clamp(${AURORA_BOX.min}px, ${AURORA_BOX.vh}vh, ${AURORA_BOX.max}px) * ${GLOW_REACH - GLOW_MIDLINE} + 1rem)`;
