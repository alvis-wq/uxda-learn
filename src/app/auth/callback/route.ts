import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/domain";
import { safeNext } from "@/lib/auth/paths";
import { queueSignInIntro } from "@/lib/intro-server";
import { createClient } from "@/lib/supabase/server";

/** OAuth (PKCE) callback: exchange the code for a session, then send the user on. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const errorPage = (reason: string) => NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin));

  // Supabase redirects here with ?error=… when sign-up fails — e.g. our DB trigger
  // rejecting a non-UXDA email surfaces as "Database error saving new user".
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) {
    return errorPage(/database error saving new user/i.test(oauthError) ? "domain" : "oauth");
  }

  const code = searchParams.get("code");
  if (!code) return errorPage("missing_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return errorPage("oauth");

  // Defence in depth: the trigger already blocks other domains at sign-up.
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return errorPage("domain");
  }

  await queueSignInIntro();
  return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
}
