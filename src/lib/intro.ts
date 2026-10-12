/**
 * Post-sign-in loader: a full-screen glass X shown while the app's first page loads, once per browser session.
 *
 * State lives in one session cookie (no Max-Age → gone when the browser closes):
 *   - absent    nothing queued yet
 *   - "pending" a sign-in happened and the loader hasn't played; the (app) / (admin) layouts render the loader
 *   - "seen"    played this browser session; later sign-ins don't queue it again
 * The server sets "pending" on sign-in; the loader itself writes "seen" when it mounts, so a reload
 * during or after it never replays it. A cookie (not sessionStorage) so the server can render the
 * overlay in the first HTML, with no flash of the app underneath.
 */
export const INTRO_COOKIE = "uxda_intro";

/** The loader never fades out before this long (ms), so it doesn't flash on a fast page. */
export const LOADER_MIN_MS = 800;
/** Fade-out (ms); reduced motion uses LOADER_FADE_REDUCED_MS. */
export const LOADER_FADE_MS = 400;
export const LOADER_FADE_REDUCED_MS = 150;
/**
 * There is deliberately no maximum while the page is loading. This is only a CSS backstop (globals.css) so a page
 * whose scripts never run can't leave the overlay up forever.
 */
export const LOADER_BACKSTOP_MS = 30_000;

/**
 * How long to wait before fading the loader out: null while the page isn't ready (no maximum), otherwise
 * whatever is left of the minimum display time (0 with reduced motion, which just fades quickly).
 */
export function loaderFadeDelay(elapsedMs: number, pageReady: boolean, reducedMotion: boolean): number | null {
  if (!pageReady) return null;
  return reducedMotion ? 0 : Math.max(0, LOADER_MIN_MS - elapsedMs);
}

export const INTRO_COOKIE_OPTIONS = { path: "/", sameSite: "lax" } as const;

/** What to store when someone signs in, or null to leave the cookie alone (already shown this session). */
export function introCookieOnSignIn(current: string | undefined): "pending" | null {
  return current === "seen" ? null : "pending";
}

export function shouldShowIntro(current: string | undefined): boolean {
  return current === "pending";
}
