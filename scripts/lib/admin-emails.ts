import { z } from "zod";

/** Parse a comma/whitespace separated ADMIN_EMAILS value into unique, lowercased emails. */
export function parseAdminEmails(raw: string | undefined): string[] {
  const emails = (raw ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    if (!z.email().safeParse(email).success) {
      throw new Error(`ADMIN_EMAILS contains an invalid email: "${email}"`);
    }
  }
  return [...new Set(emails)];
}
