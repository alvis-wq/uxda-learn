"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { googleHostedDomainHint } from "@/lib/auth/domain";
import { safeNext } from "@/lib/auth/paths";
import { isTestLoginEnabled, testUser } from "@/lib/auth/test-login";
import { queueSignInIntro } from "@/lib/intro-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signInWithGoogle(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(formData.get("next")?.toString());
  const supabase = await createClient();
  const callback = new URL("/auth/callback", await siteOrigin());
  if (next !== "/") callback.searchParams.set("next", next);

  let hd: string;
  try {
    hd = googleHostedDomainHint();
  } catch {
    return { error: "Sign-in isn't configured on this server (ALLOWED_EMAIL_DOMAINS)." };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      // hd is only a hint to Google's account picker; the DB trigger is the real gate.
      queryParams: { hd, prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return { error: "Couldn't start Google sign-in. Please try again." };
  }
  redirect(data.url);
}

const testLoginSchema = z.object({ role: z.enum(["strategist", "designer", "admin"]) });

/**
 * Dev-only sign-in as a test user. No passwords: a one-time magic-link token is generated
 * with the service role and verified server-side, so test accounts can't be signed into
 * from outside this (non-production) server.
 */
export async function testLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isTestLoginEnabled()) {
    return { error: "Test login is disabled." };
  }
  const parsed = testLoginSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { error: "Unknown test user." };
  let user: ReturnType<typeof testUser>;
  try {
    user = testUser(parsed.data.role);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Test users aren't configured." };
  }

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { data: { full_name: user.fullName, test_user: true } },
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { error: `Couldn't prepare the test user: ${linkError?.message ?? "no token"}` };
  }

  if (user.isAdmin) {
    const { error } = await admin.from("profiles").update({ is_admin: true }).eq("email", user.email);
    if (error) return { error: `Couldn't make the test user an admin: ${error.message}` };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verifyError) return { error: `Test sign-in failed: ${verifyError.message}` };

  await queueSignInIntro();
  redirect(safeNext(formData.get("next")?.toString()));
}
