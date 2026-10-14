import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Every page is per-user and auth-gated, so Cache Components is left off (see DECISIONS.md).
  // forbidden() → real 403 responses for /admin (see DECISIONS.md).
  experimental: {
    authInterrupts: true,
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
