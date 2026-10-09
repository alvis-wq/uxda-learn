import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { rankRows } from "@/lib/submissions/rules";
import { groupById, groupForTrack, LEADERBOARD_GROUPS, TRACK_LABEL } from "@/lib/tracks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard · UXDA Learn" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const profile = await requireOnboardedProfile();
  const myGroup = groupForTrack(profile.track) ?? LEADERBOARD_GROUPS[0];
  const group = groupById((await searchParams).group) ?? myGroup;
  const mixedTracks = group.tracks.length > 1;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_tracks: [...group.tracks] });
  if (error) throw new Error(`Couldn't load the leaderboard: ${error.message}`);
  const rows = rankRows(data);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <PageHeader title="Leaderboard" description="Best published score per challenge." />

      <nav aria-label="Leaderboard groups" className="bg-muted mb-6 inline-flex max-w-full flex-wrap rounded-lg p-1">
        {LEADERBOARD_GROUPS.map((g) => (
          <Link
            key={g.id}
            href={`/leaderboard?group=${g.id}`}
            aria-current={g.id === group.id ? "page" : undefined}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
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

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No one here yet" description="Complete a challenge to get on the board." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const me = r.user_id === profile.id;
              return (
                <TableRow
                  key={r.user_id}
                  aria-current={me ? "true" : undefined}
                  data-testid={me ? "leaderboard-me" : undefined}
                  className={cn(me && "bg-accent hover:bg-accent font-medium")}
                >
                  <TableCell className="tabular-nums">{r.rank}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {r.full_name ?? "Unnamed"}
                      {me && <Badge>You</Badge>}
                      {mixedTracks && (
                        <span className="text-muted-foreground text-meta">{TRACK_LABEL[r.track]}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.completed}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.total_score)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
