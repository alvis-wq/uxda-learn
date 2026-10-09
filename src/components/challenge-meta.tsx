import { Clock, Gauge, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_LABEL, TYPE_LABEL, type Challenge } from "@/lib/challenges/model";

export function ChallengeMeta({
  challenge,
}: {
  challenge: Pick<Challenge, "type" | "difficulty" | "points" | "estimated_minutes">;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <Badge variant="outline">{TYPE_LABEL[challenge.type]}</Badge>
      <span className="flex items-center gap-1">
        <Gauge className="size-4" aria-hidden />
        {DIFFICULTY_LABEL[challenge.difficulty] ?? challenge.difficulty}
      </span>
      <span className="flex items-center gap-1">
        <Trophy className="size-4" aria-hidden />
        {challenge.points} pts
      </span>
      {challenge.estimated_minutes && (
        <span className="flex items-center gap-1">
          <Clock className="size-4" aria-hidden />~{challenge.estimated_minutes} min
        </span>
      )}
    </div>
  );
}
