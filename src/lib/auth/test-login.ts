/**
 * Dev-only test login. Enabled ONLY when ENABLE_TEST_LOGIN=true AND NODE_ENV !== "production".
 * Both the UI and the server action check this; the action is the real gate.
 */
export function isTestLoginEnabled(
  env: { ENABLE_TEST_LOGIN?: string; NODE_ENV?: string } = process.env,
): boolean {
  return env.ENABLE_TEST_LOGIN === "true" && env.NODE_ENV !== "production";
}

export const TEST_USERS = {
  strategist: { email: "test-strategist@theuxda.com", fullName: "Test Strategist", isAdmin: false },
  designer: { email: "test-designer@theuxda.com", fullName: "Test Designer", isAdmin: false },
  admin: { email: "test-admin@theuxda.com", fullName: "Test Admin", isAdmin: true },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;
