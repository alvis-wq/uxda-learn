/** Routes reachable without a session. Everything else requires sign-in. */
export const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Any origin works: it is only there to see whether `next` leaves it.
const PROBE_ORIGIN = "http://next.invalid";

/**
 * Only allow same-origin relative redirects (blocks `//evil.com`, `https://…`, `/\evil`). URL parsing drops tabs and
 * newlines and reads `\` as `/`, so `/<tab>/evil.com` would become `//evil.com`: control characters and backslashes
 * are refused anywhere, and the result is parsed once more to be sure it stays on our origin.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    if (new URL(next, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
