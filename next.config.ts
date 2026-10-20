import type { NextConfig } from "next";
import { HEROES_FILE, validateHeroesFile } from "./src/lib/heroes";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

// content/heroes.yaml is checked with Zod (and every portrait must exist) whenever Next loads this config, so a bad
// file fails `next build`.
validateHeroesFile();

const nextConfig: NextConfig = {
  // Every page is per-user and auth-gated, so Cache Components is left off (see DECISIONS.md).
  // forbidden() → real 403 responses for /admin (see DECISIONS.md).
  experimental: {
    authInterrupts: true,
  },
  // next/image resizes only card artwork (public/challenges/) and hero portraits (public/heroes/), no query string: the
  // optimiser is unauthenticated (see src/proxy.ts), so it can't be pointed at anything else. The glass X fallback is
  // `unoptimized` and unaffected.
  images: {
    localPatterns: [
      { pathname: "/challenges/**", search: "" },
      { pathname: "/heroes/**", search: "" },
    ],
    qualities: [75],
  },
  // The Heroes and Profile pages read content/heroes.yaml at request time.
  outputFileTracingIncludes: { "/heroes": [`./${HEROES_FILE}`], "/profile": [`./${HEROES_FILE}`] },
  // Security headers on every route (pages, API and static files). See src/lib/security-headers.ts.
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
