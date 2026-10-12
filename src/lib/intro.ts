/**
 * Sign-in intro: the full-screen glass X splash shown right after sign-in, once per browser session.
 *
 * State lives in one session cookie (no Max-Age → gone when the browser closes):
 *   - absent    nothing queued yet
 *   - "pending" a sign-in happened and the intro hasn't played; the (app) / (admin) layouts render it
 *   - "seen"    played this browser session; later sign-ins don't queue it again
 * The server sets "pending" on sign-in; the intro itself writes "seen" when it mounts, so a reload
 * during or after it never replays it. A cookie (not sessionStorage) so the server can render the
 * overlay in the first HTML, with no flash of the app underneath.
 */
export const INTRO_COOKIE = "uxda_intro";

/** The intro is on screen for at most this long (ms), skippable at any time. */
export const INTRO_MAX_MS = 2000;
/** Fade-out when skipped (ms). */
export const INTRO_LEAVE_MS = 200;
/** The 4 s reveal plays at this rate, so the whole sequence still settles inside INTRO_MAX_MS. */
export const INTRO_SPEED = 2.5;

export const INTRO_COOKIE_OPTIONS = { path: "/", sameSite: "lax" } as const;

/** What to store when someone signs in, or null to leave the cookie alone (already shown this session). */
export function introCookieOnSignIn(current: string | undefined): "pending" | null {
  return current === "seen" ? null : "pending";
}

export function shouldShowIntro(current: string | undefined): boolean {
  return current === "pending";
}
