import { CheckCircle2, Circle, CircleDashed, Clock, Minus, RotateCcw, Route, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TEAM_STATE_LABEL, type TeamCell, type TeamCellState, type TeamMatrix } from "@/lib/team/progress";
import { TRACK_LABEL, type Track } from "@/lib/tracks";
import { cn, formatDate } from "@/lib/utils";

const STATE_ICON: Record<TeamCellState, LucideIcon> = {
  done: CheckCircle2,
  partial: CircleDashed,
  review: Clock,
  resubmit: RotateCcw,
  not_started: Circle,
  hidden: Minus,
};

const STATE_CLASS: Record<TeamCellState, string> = {
  done: "bg-primary text-primary-foreground",
  partial: "bg-accent text-accent-foreground ring-primary/70 ring-1 ring-inset",
  review: "bg-secondary text-secondary-foreground",
  resubmit: "text-warning ring-warning/60 ring-1 ring-inset",
  not_started: "text-muted-foreground",
  hidden: "text-muted-foreground/60",
};

const LEGEND: TeamCellState[] = ["done", "partial", "review", "resubmit", "not_started", "hidden"];

/** The short text in a cell: a score, or a path's milestones done. */
function shortText(cell: TeamCell, isPath: boolean): string | null {
  if (isPath && cell.milestonesTotal && (cell.state === "done" || cell.state === "partial")) {
    return `${cell.milestonesDone}/${cell.milestonesTotal}`;
  }
  if (cell.state === "done" && cell.maxPoints > 0 && cell.bestScore !== null) return `${cell.bestScore}/${cell.maxPoints}`;
  return null;
}

/** Everything about a cell in words: the screen-reader label and the hover title. */
function describe(cell: TeamCell, isPath: boolean, now: Date): string {
  const parts: string[] = [TEAM_STATE_LABEL[cell.state]];
  if (isPath && cell.milestonesTotal && cell.state !== "hidden") {
    parts.push(`${cell.milestonesDone} of ${cell.milestonesTotal} milestones done`);
  }
  if (cell.bestScore !== null && cell.maxPoints > 0) parts.push(`${cell.bestScore} / ${cell.maxPoints} pts`);
  if (cell.completedAt) parts.push(`completed ${formatDate(cell.completedAt, now)}`);
  return parts.join(" · ");
}

export function StateChip({ state, text, className }: { state: TeamCellState; text?: string | null; className?: string }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-1.5 text-xs font-medium tabular-nums",
        STATE_CLASS[state],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {text}
    </span>
  );
}

/** The matrix: people as rows, each category's challenges and paths as columns, one status cell each; then a legend. */
export function TeamMatrixView({ matrix, track, now }: { matrix: TeamMatrix; track?: Track; now: Date }) {
  const columns = matrix.groups.flatMap((g) => g.columns.map((col, i) => ({ ...col, groupStart: i === 0 })));
  return (
    <>
      {/* Scrolls sideways inside its box on narrow screens; the page itself never does (`relative` keeps the cells' sr-only labels inside it too). */}
      <div
        className="bg-card focus-visible:ring-ring/50 relative overflow-x-auto rounded-lg border outline-none focus-visible:ring-[3px]"
        role="region"
        aria-label="Team progress by challenge"
        tabIndex={0}
        data-testid="team-matrix"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Each person&apos;s status on each challenge, grouped by category
            {track ? `, ${TRACK_LABEL[track]} track` : ""}.
          </caption>
          <thead>
            <tr>
              <th
                rowSpan={2}
                scope="col"
                className="bg-card sticky left-0 z-20 border-r border-b px-3 py-2 text-left align-bottom font-medium"
              >
                Person
              </th>
              {/* Right after the name, so the summary is in view on a phone without scrolling. */}
              <th rowSpan={2} scope="col" className="border-b px-3 py-2 text-right align-bottom font-medium">
                Done
              </th>
              {matrix.groups.map((g) => (
                <th
                  key={g.slug}
                  colSpan={g.columns.length}
                  scope="colgroup"
                  className="text-muted-foreground border-b border-l px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                  data-testid="team-category"
                >
                  {g.title}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((col) => (
                <th
                  key={`${col.kind}-${col.slug}`}
                  scope="col"
                  title={col.title}
                  className={cn("w-28 border-b px-2 py-2 text-left align-bottom text-xs font-medium", col.groupStart && "border-l")}
                  data-testid="team-column"
                  data-slug={col.slug}
                >
                  <span className="line-clamp-3 break-words">{col.title}</span>
                  {col.kind === "path" && (
                    <Badge variant="outline" className="mt-1">
                      <Route aria-hidden />
                      Path
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const name = row.member.full_name ?? "Unnamed";
              return (
                <tr key={row.member.id} data-testid="team-row" data-name={name} className="group">
                  <th
                    scope="row"
                    className="bg-card group-hover:bg-muted sticky left-0 z-10 border-r border-b px-3 py-2 text-left font-normal"
                  >
                    <span className="block max-w-28 truncate font-medium sm:max-w-48" title={name}>
                      {name}
                    </span>
                    <span className="text-muted-foreground text-meta block max-w-28 truncate sm:max-w-48">{TRACK_LABEL[row.member.track]}</span>
                  </th>
                  <td className="group-hover:bg-muted/50 border-b px-3 py-2 text-right tabular-nums" data-testid="team-done">
                    {row.done}/{row.visible}
                  </td>
                  {row.cells.map((cell, i) => {
                    const col = columns[i];
                    const isPath = col.kind === "path";
                    const words = describe(cell, isPath, now);
                    return (
                      <td
                        key={`${col.kind}-${col.slug}`}
                        title={`${name} · ${col.title} · ${words}`}
                        className={cn("group-hover:bg-muted/50 border-b px-2 py-2", col.groupStart && "border-l")}
                        data-testid="team-cell"
                        data-slug={col.slug}
                        data-state={cell.state}
                      >
                        <StateChip state={cell.state} text={shortText(cell, isPath)} />
                        <span className="sr-only">{words}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul aria-label="Legend" className="text-muted-foreground text-meta mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <StateChip state={s} />
            {TEAM_STATE_LABEL[s]}
          </li>
        ))}
      </ul>
    </>
  );
}
