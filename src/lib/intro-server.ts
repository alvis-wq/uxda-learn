import "server-only";
import { cookies } from "next/headers";
import { INTRO_COOKIE, INTRO_COOKIE_OPTIONS, introCookieOnSignIn } from "@/lib/intro";

/** Call after every successful sign-in: queues the glass X loader for the first page load that follows. */
export async function queueSignInIntro(): Promise<void> {
  (await cookies()).set(INTRO_COOKIE, introCookieOnSignIn(), INTRO_COOKIE_OPTIONS);
}
