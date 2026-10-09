/**
 * Upsert ADMIN_EMAILS into admin_allowlist and promote any matching existing profiles.
 * New sign-ups on the allowlist get is_admin=true from the handle_new_user trigger.
 */
import "./lib/env";
import { parseAdminEmails } from "./lib/admin-emails";
import { adminClient } from "./lib/supabase";

async function main() {
  const emails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (emails.length === 0) {
    console.error("ADMIN_EMAILS is empty — nothing to seed.");
    process.exit(1);
  }
  const db = adminClient();

  const { error: upsertError } = await db
    .from("admin_allowlist")
    .upsert(emails.map((email) => ({ email })), { onConflict: "email" });
  if (upsertError) throw new Error(`admin_allowlist upsert failed: ${upsertError.message}`);

  const { data: promoted, error: updateError } = await db
    .from("profiles")
    .update({ is_admin: true })
    .in("email", emails)
    .select("email");
  if (updateError) throw new Error(`profiles update failed: ${updateError.message}`);

  console.log(`Allowlisted ${emails.length} admin(s): ${emails.join(", ")}`);
  console.log(`Existing profiles marked admin: ${promoted?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
