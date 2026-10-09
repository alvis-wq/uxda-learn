import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOnboardedProfile } from "@/lib/auth/session";
import type { Track } from "@/lib/challenges/model";
import { createClient } from "@/lib/supabase/server";
import { rankRows } from "@/lib/submissions/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard · UXDA Learn" };

const TABS: { track: Track; label: string }[] = [
  { track: "strategist", label: "Strategists" },
  { track: "designer", label: "Designers" },
];

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const profile = await requireOnboardedProfile();
  const requested = (await searchParams).track;
  const track: Track =
    requested === "strategist" || requested === "designer" ? requested : (profile.track ?? "strategist");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_track: track });
  if (error) throw new Error(`Couldn't load the leaderboard: ${error.message}`);
  const rows = rankRows(data);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <PageHeader title="Leaderboard" description="Best published score per challenge." />

      <nav aria-label="Leaderboard tracks" className="bg-muted mb-6 inline-flex rounded-lg p-1">
        {TABS.map((t) => (
          <Link
            key={t.track}
            href={`/leaderboard?track=${t.track}`}
            aria-current={t.track === track ? "page" : undefined}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              t.track === track ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!profile.show_on_leaderboard && profile.track === track && (
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
                    <span className="flex items-center gap-2">
                      {r.full_name ?? "Unnamed"}
                      {me && <Badge>You</Badge>}
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
