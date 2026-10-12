/**
 * The login page sequence (all times in ms from the moment the X is ready, i.e. its model is loaded):
 *
 *   0      the X appears big (1.6x) with a fade + sharpen, playing its reveal
 *   1200   it eases down to its final size over 600 (the camera moves; no CSS scale, so it stays crisp)
 *   1800   the glass card fades in (rise + scale 0.98 -> 1, 500)
 *   2300   the X fades out over 600, leaving a faint violet glow behind the card
 *   2900   done: the scene stops rendering and its GPU resources are released
 *
 * If the X isn't ready within `readyTimeoutMs` (or WebGL2 is missing, or motion is reduced) the sequence is
 * skipped straight to the end state, so signing in is never blocked. It plays every time the login page loads.
 */
export const LOGIN_SEQ = {
  readyTimeoutMs: 1000,
  startZoom: 1.6,
  zoomAtMs: 1200,
  zoomMs: 600,
  cardAtMs: 1800,
  cardMs: 500,
  xFadeAtMs: 2300,
  xFadeMs: 600,
  /** CSS safety net: the card appears by itself this long after load even if no script runs. */
  cardFailsafeMs: 4000,
};

export const LOGIN_SEQ_END_MS = LOGIN_SEQ.xFadeAtMs + LOGIN_SEQ.xFadeMs;

/**
 * Camera distance for the login X, tuned for the big square canvas it lives in (`min(140vmin, 1100px)`): at zoom 1
 * the X is ~42% of the canvas wide; at the start zoom (1.6) ~66%, with its tips still inside the canvas' opaque 90%.
 */
export const LOGIN_X_DISTANCE = 19.7;
