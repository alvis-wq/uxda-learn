import { SignInLoaderGate } from "@/components/glass-x/sign-in-loader-gate";
import { SiteHeader } from "@/components/site-header";
import { requireAcademyEditor } from "@/lib/auth/academy-editor";
import { requireOnboardedProfile } from "@/lib/auth/session";

/**
 * Academy management for Academy editors who aren't admins (admins use Admin → Academy; the pages are shared). Its
 * own route group, like (admin) and (lead): no loading.tsx above this layout, so forbidden() gives a real 403.
 */
export default async function AcademyEditorLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedProfile();
  const profile = await requireAcademyEditor();
  return (
    <>
      <SiteHeader profile={profile} />
      <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
      </div>
      <SignInLoaderGate />
    </>
  );
}
