import { TEST_USER_ROLES, testUser } from "../../src/lib/auth/test-login";
import type { DomainEnv } from "../../src/lib/auth/domain";

export type ResetArgs = {
  /** Delete for real. Without it the script only lists what it would delete. */
  apply: boolean;
  /** Real accounts whose data is wiped (the accounts themselves stay). */
  emails: string[];
  /** The test accounts (test-strategist@…, test-designer@…, test-admin@…): data AND account are removed. */
  testEmails: string[];
};

const EMAIL = /^[^\s@,*%?]+@[^\s@,*%?]+\.[^\s@,*%?]+$/;

/**
 * `reset-user-data [--apply] [email ...]`. Emails are exact addresses (lowercased, de-duplicated, no wildcards).
 * The test users are always included, so leftovers from test logins are cleaned up on every run; naming one of
 * them as an email is harmless (it is handled as a test user, not twice).
 */
export function parseResetArgs(argv: string[], env: DomainEnv = process.env): ResetArgs {
  const testEmails = TEST_USER_ROLES.map((role) => testUser(role, env).email.toLowerCase());
  const emails: string[] = [];
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--test-project") continue; // read by scripts/lib/env.ts
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!EMAIL.test(arg)) throw new Error(`Not an exact email address: "${arg}" (wildcards and lists are not supported)`);
    else {
      const email = arg.toLowerCase();
      if (!testEmails.includes(email) && !emails.includes(email)) emails.push(email);
    }
  }
  return { apply, emails, testEmails };
}
