import { SiteHeader } from "@/components/site-header";
import { requireOnboardedProfile } from "@/lib/auth/session";

/** Everything in (app) needs a signed-in, onboarded UXDA user. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireOnboardedProfile();
  return (
    <>
      <SiteHeader profile={profile} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
