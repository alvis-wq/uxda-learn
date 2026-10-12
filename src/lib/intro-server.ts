import "server-only";
import { cookies } from "next/headers";
import { INTRO_COOKIE, INTRO_COOKIE_OPTIONS, introCookieOnSignIn } from "@/lib/intro";

/** Call after a successful sign-in: queues the glass X intro unless it already played this browser session. */
export async function queueSignInIntro(): Promise<void> {
  const store = await cookies();
  const value = introCookieOnSignIn(store.get(INTRO_COOKIE)?.value);
  if (value) store.set(INTRO_COOKIE, value, INTRO_COOKIE_OPTIONS);
}
