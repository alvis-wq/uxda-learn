import "server-only";
import { forbidden, redirect } from "next/navigation";
import { canSeeTeam } from "@/lib/auth/roles";
import { getCurrentProfile, getCurrentUser, type Profile } from "@/lib/auth/session";

/** For the Team page: 403 for anyone who is neither a lead nor an admin (checked against the DB on every request). */
export async function requireLead(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile || !canSeeTeam(profile)) forbidden();
  return profile;
}
