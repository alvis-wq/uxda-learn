import { cookies } from "next/headers";
import { INTRO_COOKIE, shouldShowIntro } from "@/lib/intro";
import { SignInIntro } from "./sign-in-intro";

/** Renders the sign-in intro inside the first HTML when a sign-in queued it (see src/lib/intro.ts). */
export async function SignInIntroGate() {
  const value = (await cookies()).get(INTRO_COOKIE)?.value;
  return shouldShowIntro(value) ? <SignInIntro /> : null;
}
