import type { Profile } from "@/lib/auth/session";

/** The Team page (everyone's progress) is for leads, and for admins without the lead flag. */
export function canSeeTeam(profile: Pick<Profile, "is_admin" | "is_lead"> | null | undefined): boolean {
  return !!profile && (profile.is_admin || profile.is_lead);
}
