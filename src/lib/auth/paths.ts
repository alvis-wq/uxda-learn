/** Routes reachable without a session. Everything else requires sign-in. */
export const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only allow same-origin relative redirects (blocks `//evil.com`, `https://…`, `/\evil`). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
