import { requireOnboardedProfile } from "@/lib/auth/session";

const TRACK_LABEL = { strategist: "Strategist", designer: "Designer" } as const;

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const firstName = profile.full_name?.split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-muted-foreground mt-1">
        You&apos;re on the {profile.track ? TRACK_LABEL[profile.track] : ""} track.
      </p>
      <div className="text-muted-foreground mt-8 rounded-lg border border-dashed p-8 text-center text-sm">
        Your challenges will appear here soon.
      </div>
    </main>
  );
}
