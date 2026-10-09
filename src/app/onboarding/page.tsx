import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Choose your track · UXDA Learn" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/error?reason=profile");
  if (profile.track) redirect("/");

  const firstName = profile.full_name?.split(" ")[0];

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Welcome{firstName ? `, ${firstName}` : ""}</h1>
          </CardTitle>
          <CardDescription>
            Which track are you on? You&apos;ll see shared challenges plus the ones for your track.
            Only an admin can change this later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrackForm />
        </CardContent>
      </Card>
    </main>
  );
}
