import { Clock, Gauge, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABEL, TYPE_LABEL, type Challenge } from "@/lib/challenges/model";

export function ChallengeMeta({
  challenge,
  nowrap = false,
}: {
  challenge: Pick<Challenge, "type" | "difficulty" | "points" | "estimated_minutes">;
  /** One line that never wraps (the challenge cards' first meta row); otherwise the items wrap. */
  nowrap?: boolean;
}) {
  // Acknowledge challenges have no difficulty and are worth no points.
  const scored = challenge.type !== "acknowledge";
  return (
    <div className={cn("text-muted-foreground flex items-center", nowrap ? "gap-x-2.5 overflow-hidden whitespace-nowrap text-xs [&_svg]:size-3.5" : "text-meta flex-wrap gap-x-4 gap-y-2")}>
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
      {challenge.estimated_minutes && (
        <span className="flex items-center gap-1">
          <Clock className="size-4" aria-hidden />~{challenge.estimated_minutes} min
        </span>
      )}
    </div>
  );
}
