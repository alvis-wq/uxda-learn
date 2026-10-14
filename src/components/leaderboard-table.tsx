import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRACK_LABEL, type Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

type Row = { user_id: string; full_name: string | null; track: Track; completed: number; total_score: number };

/**
 * The leaderboard: everyone with points, ranked, then everyone without, under a small "Not started yet" label with no
 * rank number (see splitLeaderboard).
 */
export function LeaderboardTable({
  ranked,
  notStarted,
  meId,
  mixedTracks,
}: {
  ranked: (Row & { rank: number })[];
  notStarted: Row[];
  meId: string;
  mixedTracks: boolean;
}) {
  return (
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
        {ranked.map((r) => (
          <LeaderboardRow key={r.user_id} row={r} rank={r.rank} me={r.user_id === meId} mixedTracks={mixedTracks} />
        ))}
      </TableBody>
      {notStarted.length > 0 && (
        <TableBody data-testid="not-started">
          <TableRow className="hover:bg-transparent">
            <TableHead colSpan={4} scope="colgroup" className="text-muted-foreground pt-6 text-xs font-semibold tracking-wide uppercase">
              Not started yet
            </TableHead>
          </TableRow>
          {notStarted.map((r) => (
            <LeaderboardRow key={r.user_id} row={r} rank={null} me={r.user_id === meId} mixedTracks={mixedTracks} />
          ))}
        </TableBody>
      )}
    </Table>
  );
}

function LeaderboardRow({ row: r, rank, me, mixedTracks }: { row: Row; rank: number | null; me: boolean; mixedTracks: boolean }) {
  return (
    <TableRow
      aria-current={me ? "true" : undefined}
      data-testid={me ? "leaderboard-me" : undefined}
      className={cn(me && "bg-accent hover:bg-accent font-medium")}
    >
      <TableCell className="tabular-nums">
        {rank ?? (
          <>
            <span aria-hidden>–</span>
            <span className="sr-only">No rank yet</span>
          </>
        )}
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {r.full_name ?? "Unnamed"}
          {me && <Badge>You</Badge>}
          {mixedTracks && <span className="text-muted-foreground text-meta">{TRACK_LABEL[r.track]}</span>}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{r.completed}</TableCell>
      <TableCell className="text-right tabular-nums">{Number(r.total_score)}</TableCell>
    </TableRow>
  );
}
