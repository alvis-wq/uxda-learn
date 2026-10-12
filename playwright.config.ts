import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { resolveTestProject } from "./tests/support/test-project";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * E2E writes real data (users, submissions, uploads), so it runs ONLY against a separate
 * Supabase project from TEST_SUPABASE_*. Not configured → every test is skipped and no
 * server is started. Pointing it at the main project is refused (see tests/support).
 */
const { project } = resolveTestProject();

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// Cloud sessions ship a pre-installed Chromium; use it when present instead of downloading.
const preinstalled = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

export default defineConfig({
  testDir: "./e2e",
  // Fixture challenges in their own category; all test-user data is wiped before and after.
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    // The glass X intro and login animation are skipped under reduced motion (static X, card shown at once),
    // which keeps every other spec fast and deterministic. e2e/glass-x.spec.ts opts back in to test them.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  // `next dev`, not `next start`: test login is (by design) unavailable in production mode.
  // The app is pointed at the test project; never reuse a server that might use the main one.
  webServer: project
    ? {
        command: `npx next dev --port ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: project.url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: project.anonKey,
          SUPABASE_SERVICE_ROLE_KEY: project.serviceRoleKey,
          ENABLE_TEST_LOGIN: "true",
        },
      }
    : undefined,
});
