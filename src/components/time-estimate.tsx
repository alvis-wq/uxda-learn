import { Clock, Hourglass } from "lucide-react";
import { timeParts, type TimeEstimate as Time } from "@/lib/challenges/time";
import { WaitingInfo } from "@/components/waiting-info";
import { cn } from "@/lib/utils";

/**
 * "~10 min hands-on · ~10 min waiting · ~20 min total" (or "~20 min") with a clock icon. On a narrow screen the line
 * wraps between the values (each keeps its dot at the end of its line), never inside one. The waiting value has an
 * info button after it that explains waiting time.
 */
export function TimeEstimate({ time, className }: { time: Time; className?: string }) {
  const parts = timeParts(time);
  // With waiting time the parts are hands-on, waiting, total.
  const waitingAt = time.waiting > 0 ? 1 : -1;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)} data-testid="time-estimate">
      <Clock className="size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-wrap gap-x-1 tabular-nums">
        {parts.map((part, i) => (
          <span key={part} className="whitespace-nowrap">
            {part}
            {i === waitingAt && (
              <>
                {" "}
                <WaitingInfo />
              </>
            )}
            {i < parts.length - 1 && <span aria-hidden> ·</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

/** On a challenge with waiting time: a small note above its steps that the learner can do other things meanwhile. */
export function WaitingNote() {
  return (
    <aside
      aria-label="Waiting time"
      data-testid="waiting-note"
      className="bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <Hourglass className="mt-[3px] size-4 shrink-0" aria-hidden />
      <p className="leading-snug">
        Part of this time is waiting while Claude Code works. Use it for other tasks and come back when it&apos;s done.
      </p>
    </aside>
  );
}
