import { SignInLoaderGate } from "@/components/glass-x/sign-in-loader-gate";
import { SiteHeader } from "@/components/site-header";
import { requireLead } from "@/lib/auth/lead";
import { requireOnboardedProfile } from "@/lib/auth/session";

/**
 * The Team page, for leads and admins. Its own route group (like (admin)): no loading.tsx above this layout, so the
 * lead check runs before anything streams and forbidden() produces a real 403 status.
 */
export default async function LeadGroupLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedProfile();
  const profile = await requireLead();
  return (
    <>
      <SiteHeader profile={profile} />
      <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <SignInLoaderGate />
    </>
  );
}
