import { type DomainEnv, primaryEmailDomain } from "./domain";

/**
 * Dev-only test login. Enabled ONLY when ENABLE_TEST_LOGIN=true AND NODE_ENV !== "production".
 * Both the UI and the server action check this; the action is the real gate.
 */
export function isTestLoginEnabled(
  env: { ENABLE_TEST_LOGIN?: string; NODE_ENV?: string } = process.env,
): boolean {
  return env.ENABLE_TEST_LOGIN === "true" && env.NODE_ENV !== "production";
}

const TEST_USERS = {
  strategist: { fullName: "Test Strategist", isAdmin: false },
  designer: { fullName: "Test Designer", isAdmin: false },
  admin: { fullName: "Test Admin", isAdmin: true },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;
export const TEST_USER_ROLES = Object.keys(TEST_USERS) as TestUserRole[];

/** Test users live on the first ALLOWED_EMAIL_DOMAINS domain, e.g. test-admin@<domain>. */
export function testUser(role: TestUserRole, env: DomainEnv = process.env) {
  return { ...TEST_USERS[role], email: `test-${role}@${primaryEmailDomain(env)}` };
}
