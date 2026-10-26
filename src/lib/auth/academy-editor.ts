import "server-only";
import { forbidden, redirect } from "next/navigation";
import { canEditAcademy } from "@/lib/auth/roles";
import { getCurrentProfile, getCurrentUser, type Profile } from "@/lib/auth/session";

/** For Academy management pages: 403 for anyone who is neither an Academy editor nor an admin. */
export async function requireAcademyEditor(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile || !canEditAcademy(profile)) forbidden();
  return profile;
}

/** For Academy management server actions: the editor's (or admin's) profile, or null. */
export async function getAcademyEditorOrNull(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getCurrentProfile();
  return canEditAcademy(profile) ? profile : null;
}
