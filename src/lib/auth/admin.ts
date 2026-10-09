import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser, type Profile } from "@/lib/auth/session";

/** For admin pages: 403 for anyone who isn't an admin (checked against the DB on every request). */
export async function requireAdmin(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) forbidden();
  return profile;
}

/** For admin server actions / route handlers: the admin's profile, or null. */
export async function getAdminOrNull(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getCurrentProfile();
  return profile?.is_admin ? profile : null;
}
