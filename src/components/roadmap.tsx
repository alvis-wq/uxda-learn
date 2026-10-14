import Link from "next/link";
import { CheckCircle2, Circle, Clock, Lock, PencilLine, RotateCcw, type LucideIcon } from "lucide-react";
import { MILESTONE_STATUS_LABEL, type MilestoneState, type MilestoneStatus } from "@/lib/paths/progress";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<MilestoneStatus, LucideIcon> = {
  locked: Lock,
  not_started: Circle,
  in_progress: PencilLine,
  awaiting_review: Clock,
  changes_requested: RotateCcw,
  done: CheckCircle2,
};

const STATUS_TONE: Record<MilestoneStatus, string> = {
  locked: "text-muted-foreground",
  not_started: "text-muted-foreground",
  in_progress: "text-foreground",
  awaiting_review: "text-foreground",
  changes_requested: "text-destructive",
  done: "text-success",
};

/**
 * The path's milestones as a vertical roadmap: one node per milestone (its number), joined by a track. The segment
 * below a node is filled once that milestone is done, so the track fills from the top as the learner goes. An
 * unlocked node is a link to its challenge (the whole row is clickable); a locked one is plain text that says what
 * opens it. Nothing animates.
 */
export function Roadmap({
  states,
  sequential,
  showScores,
}: {
  states: MilestoneState[];
  sequential: boolean;
  /** False for a tester's draft: test attempts have no score. */
  showScores: boolean;
}) {
  // The learner's next step: the first unlocked milestone they can act on (not done, not waiting for a review).
  const current = states.find((s) => s.unlocked && !s.done && s.status !== "awaiting_review")?.slug;

  return (
    <ol className="grid" data-testid="roadmap">
      {states.map((s, i) => {
        const Icon = STATUS_ICON[s.status];
        const last = i === states.length - 1;
        const isCurrent = s.slug === current;
        return (
          <li
            key={s.slug}
            data-testid="milestone"
            data-status={s.status}
            data-slug={s.slug}
            className={cn(
              "group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 rounded-xl",
              !last && "pb-6",
              s.unlocked && "has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-[3px]",
            )}
          >
            {!last && (
              <span
                aria-hidden
                data-testid="track-segment"
                data-filled={s.done ? "" : undefined}
                className={cn(
                  "absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2",
                  s.done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-[1] grid size-10 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums",
                s.done
                  ? "bg-primary border-primary text-primary-foreground"
                  : s.unlocked
                    ? cn("bg-background", isCurrent ? "border-primary text-foreground" : "border-border text-foreground")
                    : "bg-background border-border text-muted-foreground border-dashed",
              )}
            >
              {s.position}
            </span>
            <div className="grid min-w-0 gap-1 pt-1.5">
              <h3 className={cn("leading-snug font-medium", !s.unlocked && "text-muted-foreground")}>
                {s.unlocked ? (
                  <Link
                    href={`/challenges/${s.slug}`}
                    className="outline-none group-hover:underline after:absolute after:inset-0 after:z-10 after:content-[''] underline-offset-4"
                  >
                    {s.title}
                  </Link>
                ) : (
                  s.title
                )}
              </h3>
              <p className="text-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn("inline-flex items-center gap-1 font-medium", STATUS_TONE[s.status])} data-testid="milestone-status">
                  <Icon className="size-3.5" aria-hidden />
                  {MILESTONE_STATUS_LABEL[s.status]}
                </span>
                {showScores && s.bestScore !== null && (
                  <span className="tabular-nums" data-testid="milestone-score">
                    {s.bestScore} / {s.points} pts
                  </span>
                )}
                {showScores && s.bestScore === null && <span className="text-muted-foreground tabular-nums">{s.points} pts</span>}
                {!s.unlocked && sequential && i > 0 && (
                  <span className="text-muted-foreground">Submit milestone {i} first</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
