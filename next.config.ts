import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Every page is per-user and auth-gated, so Cache Components is left off (see DECISIONS.md).
  // forbidden() → real 403 responses for /admin (see DECISIONS.md).
  experimental: {
    authInterrupts: true,
  },
  // next/image resizes only card artwork (public/challenges/, no query string): the optimiser is unauthenticated (see
  // src/proxy.ts), so it can't be pointed at anything else. The glass X fallback is `unoptimized` and unaffected.
  images: {
    localPatterns: [{ pathname: "/challenges/**", search: "" }],
    qualities: [75],
  },
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
