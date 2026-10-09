import { describe, expect, it } from "vitest";
import { isTestLoginEnabled, TEST_USERS } from "./test-login";
import { isAllowedEmail } from "./domain";

describe("isTestLoginEnabled", () => {
  it("is disabled when NODE_ENV=production, even with ENABLE_TEST_LOGIN=true", () => {
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "true", NODE_ENV: "production" })).toBe(false);
  });

  it("is enabled only with ENABLE_TEST_LOGIN=true outside production", () => {
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "true", NODE_ENV: "development" })).toBe(true);
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "true", NODE_ENV: "test" })).toBe(true);
  });

  it("is disabled when the flag is missing or not exactly 'true'", () => {
    expect(isTestLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "false", NODE_ENV: "development" })).toBe(false);
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "1", NODE_ENV: "development" })).toBe(false);
    expect(isTestLoginEnabled({ ENABLE_TEST_LOGIN: "TRUE", NODE_ENV: "development" })).toBe(false);
  });

  it("only defines UXDA test users", () => {
    for (const u of Object.values(TEST_USERS)) expect(isAllowedEmail(u.email)).toBe(true);
  });
});
