import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** The verified signed-in user (validated with the Auth server), or null. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** The signed-in user's own profile (read through RLS), or null. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** For pages that need a fully onboarded user: redirects to /login or /onboarding otherwise. */
export async function requireOnboardedProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/error?reason=profile");
  if (!profile.track) redirect("/onboarding");
  return profile;
}
