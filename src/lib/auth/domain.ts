/** The only email domain allowed to sign in. Also enforced by the handle_new_user DB trigger. */
export const ALLOWED_EMAIL_DOMAIN = "theuxda.com";

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1).toLowerCase() === ALLOWED_EMAIL_DOMAIN;
}
