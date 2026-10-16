import { Gauge, Trophy } from "lucide-react";
import { TimeEstimate } from "@/components/time-estimate";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABEL, TYPE_LABEL, type Challenge } from "@/lib/challenges/model";
import { timeOf } from "@/lib/challenges/time";

export function ChallengeMeta({
  challenge,
  compact = false,
}: {
  challenge: Pick<Challenge, "type" | "difficulty" | "points" | "estimated_minutes" | "waiting_minutes">;
  /** Small and tightly spaced (the challenge cards' first meta row, beside the card's illustration); items still wrap. */
  compact?: boolean;
}) {
  // Acknowledge challenges have no difficulty and are worth no points.
  const scored = challenge.type !== "acknowledge";
  const time = timeOf(challenge);
  // Hands-on, waiting and total are too long for the cards' compact row: there they get a row of their own.
  const timeOwnRow = compact && !!time && time.waiting > 0;
  const row = (
    <div className={cn("text-muted-foreground flex items-center", compact ? "flex-wrap gap-x-2.5 gap-y-1 text-xs [&_svg]:size-3.5" : "text-meta flex-wrap gap-x-4 gap-y-2")}>
      <Badge variant="outline">{TYPE_LABEL[challenge.type]}</Badge>
      {scored && (
        <span className="flex items-center gap-1">
          <Gauge className="size-4" aria-hidden />
          {DIFFICULTY_LABEL[challenge.difficulty] ?? challenge.difficulty}
        </span>
      )}
      {scored && (
        <span className="flex items-center gap-1">
          <Trophy className="size-4" aria-hidden />
          {challenge.points} pts
        </span>
      )}
      {time && !timeOwnRow && <TimeEstimate time={time} />}
    </div>
  );
  if (!timeOwnRow) return row;
  return (
    <>
      {row}
      <TimeEstimate time={time} className="text-muted-foreground text-xs [&_svg]:size-3.5" />
    </>
  );
}
