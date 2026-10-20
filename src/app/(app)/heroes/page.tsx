import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HeroGrid } from "@/components/hero-grid";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { loadHeroes } from "@/lib/heroes";
import { createClient } from "@/lib/supabase/server";
import { splitLeaderboard } from "@/lib/submissions/rules";
import { groupById, groupForTrack, LEADERBOARD_GROUPS } from "@/lib/tracks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Heroes · UXDA Learn" };

export default async function HeroesPage({ searchParams }: PageProps<"/heroes">) {
  const profile = await requireOnboardedProfile();
  const myGroup = groupForTrack(profile.track) ?? LEADERBOARD_GROUPS[0];
  const group = groupById((await searchParams).group) ?? myGroup;
  const mixedTracks = group.tracks.length > 1;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_tracks: [...group.tracks] });
  if (error) throw new Error(`Couldn't load the leaderboard: ${error.message}`);
  // Everyone with points is ranked; people with none have no rank and come last, under "Not started yet".
  const { ranked, notStarted } = splitLeaderboard(data);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Heroes" />
      </div>

      <section aria-labelledby="leaderboard-heading" className="mx-auto max-w-3xl">
        <h2 id="leaderboard-heading" className="text-xl font-semibold tracking-tight">
          UXDA Learn Leaderboard
        </h2>
        <p className="text-muted-foreground mt-1 mb-6">Best published score per challenge.</p>

        <nav aria-label="Leaderboard groups" className="bg-muted mb-6 inline-flex max-w-full flex-wrap rounded-full p-1">
          {LEADERBOARD_GROUPS.map((g) => (
            <Link
              key={g.id}
              href={`/heroes?group=${g.id}`}
              aria-current={g.id === group.id ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                g.id === group.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </Link>
          ))}
        </nav>

        {!profile.show_on_leaderboard && group.id === myGroup.id && (
          <Alert className="mb-4">
            <EyeOff aria-hidden />
            <AlertDescription>
              <span>
                You&apos;re hidden from the leaderboard. <Link href="/profile" className="underline">Change this in your profile.</Link>
              </span>
            </AlertDescription>
          </Alert>
        )}

        {ranked.length + notStarted.length === 0 ? (
          <EmptyState icon={Trophy} title="No one here yet" description="Complete a challenge to get on the board." />
        ) : (
          <LeaderboardTable ranked={ranked} notStarted={notStarted} meId={profile.id} mixedTracks={mixedTracks} />
        )}
      </section>

      <section aria-labelledby="superheroes-heading" className="mt-16">
        <div className="mb-8 text-center">
          <h2 id="superheroes-heading" className="text-xl font-semibold tracking-tight">
            UXDA Superhero Team
          </h2>
          <p className="text-muted-foreground mt-1">Meet the heroes behind UXDA: who they are and what makes them super.</p>
        </div>
        <HeroGrid heroes={loadHeroes()} />
      </section>
    </main>
  );
}
