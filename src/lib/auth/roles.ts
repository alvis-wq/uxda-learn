import type { Profile } from "@/lib/auth/session";

/** The Team page (everyone's progress) is for leads, and for admins without the lead flag. */
export function canSeeTeam(profile: Pick<Profile, "is_admin" | "is_lead"> | null | undefined): boolean {
  return !!profile && (profile.is_admin || profile.is_lead);
}

/** Academy editors add and edit Academy resources and their quizzes; admins can too without the flag. */
export function canEditAcademy(profile: Pick<Profile, "is_admin" | "is_academy_editor"> | null | undefined): boolean {
  return !!profile && (profile.is_admin || profile.is_academy_editor);
}
