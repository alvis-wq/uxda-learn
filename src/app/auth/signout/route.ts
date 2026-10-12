import { NextResponse, type NextRequest } from "next/server";
import { INTRO_COOKIE, INTRO_COOKIE_CLEAR_OPTIONS } from "@/lib/intro";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with GET.
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
  // The next sign-in is a new one: forget that the loader already played.
  response.cookies.set(INTRO_COOKIE, "", INTRO_COOKIE_CLEAR_OPTIONS);
  return response;
}
