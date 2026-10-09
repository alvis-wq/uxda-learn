import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/admin";
import { requireOnboardedProfile } from "@/lib/auth/session";

/**
 * Separate route group from (app) on purpose: no loading.tsx above this layout, so the
 * admin check runs before anything streams and forbidden() produces a real 403 status.
 */
export default async function AdminGroupLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedProfile();
  const profile = await requireAdmin();
  return (
    <>
      <SiteHeader profile={profile} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
