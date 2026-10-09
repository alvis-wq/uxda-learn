import { describe, expect, it } from "vitest";
import { isTestLoginEnabled, TEST_USER_ROLES, testUser } from "./test-login";
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

});

describe("testUser", () => {
  const env = { ALLOWED_EMAIL_DOMAINS: "uxdesignagency.com,theuxda.com" };

  it("puts test users on the first allowed domain", () => {
    expect(testUser("strategist", env).email).toBe("test-strategist@uxdesignagency.com");
    expect(testUser("designer", env).email).toBe("test-designer@uxdesignagency.com");
    expect(testUser("admin", env)).toMatchObject({ email: "test-admin@uxdesignagency.com", isAdmin: true });
  });

  it("only defines allowed-domain test users", () => {
    for (const role of TEST_USER_ROLES) expect(isAllowedEmail(testUser(role, env).email, env)).toBe(true);
  });

  it("throws when no domain is configured", () => {
    expect(() => testUser("admin", {})).toThrow(/ALLOWED_EMAIL_DOMAINS/);
  });
});
