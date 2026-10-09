/**
 * Sync ALLOWED_EMAIL_DOMAINS into allowed_email_domains: add missing domains and remove any
 * that are no longer configured. The handle_new_user trigger only accepts sign-ups whose
 * email domain is in this table.
 */
import "./lib/env";
import { parseAllowedDomains } from "../src/lib/auth/domain";
import { adminClient } from "./lib/supabase";

async function main() {
  const domains = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);
  if (domains.length === 0) {
    console.error("ALLOWED_EMAIL_DOMAINS is empty — refusing to lock everyone out.");
    process.exit(1);
  }
  const db = adminClient();

  const { error: upsertError } = await db
    .from("allowed_email_domains")
    .upsert(domains.map((domain) => ({ domain })), { onConflict: "domain" });
  if (upsertError) throw new Error(`allowed_email_domains upsert failed: ${upsertError.message}`);

  const { data: removed, error: deleteError } = await db
    .from("allowed_email_domains")
    .delete()
    .not("domain", "in", `(${domains.map((d) => `"${d}"`).join(",")})`)
    .select("domain");
  if (deleteError) throw new Error(`allowed_email_domains cleanup failed: ${deleteError.message}`);

  console.log(`Allowed email domains: ${domains.join(", ")}`);
  if (removed?.length) console.log(`Removed: ${removed.map((r) => r.domain).join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
