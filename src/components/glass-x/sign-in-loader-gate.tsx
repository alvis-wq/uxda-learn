import { cookies } from "next/headers";
import { INTRO_COOKIE, shouldShowIntro } from "@/lib/intro";
import { SignInLoader } from "./sign-in-loader";

/** Renders the post-sign-in loader inside the first HTML when a sign-in queued it (see src/lib/intro.ts). */
export async function SignInLoaderGate() {
  const value = (await cookies()).get(INTRO_COOKIE)?.value;
  return shouldShowIntro(value) ? <SignInLoader /> : null;
}
