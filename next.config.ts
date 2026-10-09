import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user and auth-gated, so Cache Components is left off (see DECISIONS.md).
  // forbidden() → real 403 responses for /admin (see DECISIONS.md).
  experimental: {
    authInterrupts: true,
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
