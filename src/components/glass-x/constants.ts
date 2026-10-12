/**
 * The X stage is always this dark colour (the dark theme's --background), also in light mode.
 * The X itself renders on pure black (glass-x's designed setup; any other clear colour washes out
 * once the reveal ends) and the canvas is screen-blended onto this colour, so black becomes exactly
 * this colour while the glass and bloom stay as designed. Put the X on a surface with this background.
 */
export const STAGE_BACKGROUND = "#17181C";

/** The settled end state, rendered on STAGE_BACKGROUND. Shown for reduced motion and when WebGL2 or the model isn't available. */
export const FALLBACK_IMAGE = "/brand/glass-x.png";
