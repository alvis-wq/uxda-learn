/**
 * Response headers sent on every route (see next.config.ts). Deliberately NOT a full script CSP yet: the glass X
 * (WebGL), the font files, the intro sound and Supabase need a careful policy of their own. `frame-ancestors` is the
 * one CSP directive that is safe to ship alone: nothing may embed this app in a frame (clickjacking).
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  // Clickjacking: no framing. The old header and its CSP twin, for browsers that only know one of them.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Don't second-guess the declared type (an uploaded file can't be run as a script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see our origin but never a path or query (which can hold ids and next= targets).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these; an injected script or an embedded frame can't switch them on either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS only for a year. No includeSubDomains / preload: those also bind sibling subdomains and are hard to undo.
  // Browsers ignore it over plain http, so localhost is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];
