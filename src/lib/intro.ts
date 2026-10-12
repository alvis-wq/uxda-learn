/**
 * Post-sign-in loader: a full-screen glass X shown while the app's first page loads, once per browser session.
 *
 * State lives in one session cookie (no Max-Age → gone when the browser closes):
 *   - absent    nothing queued (not signed in, or signed out)
 *   - "pending" a sign-in just happened and the loader hasn't played; the (app) / (admin) layouts render the loader
 *   - "seen"    played for the current sign-in; reloads and navigation don't show it again
 * Every new sign-in (OAuth callback, dev test login) sets "pending", whatever the cookie held before; sign-out
 * clears it. The loader itself writes "seen" when it mounts, so a reload during or after it never replays it. A cookie (not sessionStorage) so the server can render the
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

/** Every new sign-in queues the loader, even if an earlier sign-in's "seen" is still there. */
export function introCookieOnSignIn(): "pending" {
  return "pending";
}

/** Sign-out expires the cookie, so the next sign-in starts from nothing. */
export const INTRO_COOKIE_CLEAR_OPTIONS = { path: "/", maxAge: 0 } as const;

export function shouldShowIntro(current: string | undefined): boolean {
  return current === "pending";
}
