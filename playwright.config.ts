import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

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
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  // E2E runs against `next dev`: test login is (by design) unavailable in production mode.
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ENABLE_TEST_LOGIN: "true" },
  },
});
