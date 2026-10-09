import { z } from "zod";

/**
 * Allowed sign-in email domains come from ALLOWED_EMAIL_DOMAINS (comma-separated).
 * The real gate is the handle_new_user DB trigger, which checks the allowed_email_domains
 * table (synced from the same env var by `npm run seed:domains`). The app uses the env var
 * for the Google `hd` hint, the auth-callback re-check, test user emails and UI copy.
 */
export type DomainEnv = { ALLOWED_EMAIL_DOMAINS?: string; [name: string]: string | undefined };

const domainSchema = z
  .string()
  .regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);

/** Parse a comma/whitespace separated domain list into unique, lowercased domains. */
export function parseAllowedDomains(raw: string | undefined): string[] {
  const domains = (raw ?? "")
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  for (const domain of domains) {
    if (!domainSchema.safeParse(domain).success) {
      throw new Error(`ALLOWED_EMAIL_DOMAINS contains an invalid domain: "${domain}"`);
    }
  }
  return [...new Set(domains)];
}

/** The configured domains. Throws if none are set — sign-in can't work without them. */
export function allowedEmailDomains(env: DomainEnv = process.env): string[] {
  const domains = parseAllowedDomains(env.ALLOWED_EMAIL_DOMAINS);
  if (domains.length === 0) {
    throw new Error("ALLOWED_EMAIL_DOMAINS is not set. See .env.example.");
  }
  return domains;
}

/** The first configured domain — used for generated addresses such as test users. */
export function primaryEmailDomain(env: DomainEnv = process.env): string {
  return allowedEmailDomains(env)[0];
}

/**
 * Google's `hd` account-picker hint takes a single domain; with several, "*" limits the
 * picker to Workspace accounts. It's only a hint either way — the DB trigger decides.
 */
export function googleHostedDomainHint(env: DomainEnv = process.env): string {
  const domains = allowedEmailDomains(env);
  return domains.length === 1 ? domains[0] : "*";
}

/** "@a.com", "@a.com or @b.com", "@a.com, @b.com or @c.com" */
export function formatAllowedDomains(env: DomainEnv = process.env): string {
  const list = allowedEmailDomains(env).map((d) => `@${d}`);
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} or ${list.at(-1)}`;
}

export function isAllowedEmail(email: string | null | undefined, env: DomainEnv = process.env): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  return at > 0 && allowedEmailDomains(env).includes(email.slice(at + 1).toLowerCase());
}
