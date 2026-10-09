import { CalendarClock, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isOverdue } from "@/lib/challenges/required";
import { formatDate } from "@/lib/utils";

/** "Required" plus a due / overdue badge. Renders nothing for optional, undated challenges. */
export function RequiredBadges({
  required,
  dueAt,
  done,
  now = new Date(),
}: {
  required: boolean;
  dueAt: string | null;
  done: boolean;
  now?: Date;
}) {
  const overdue = isOverdue(dueAt, done, now);
  if (!required && !(dueAt && !done)) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {required && (
        <Badge variant="outline" className="border-primary" data-testid="required-badge">
          <Flag aria-hidden />
          Required
        </Badge>
      )}
      {dueAt && !done && (
        <Badge variant={overdue ? "destructive" : "outline"} data-testid={overdue ? "overdue-badge" : "due-badge"}>
          <CalendarClock aria-hidden />
          {overdue ? `Overdue · was due ${formatDate(dueAt)}` : `Due ${formatDate(dueAt)}`}
        </Badge>
      )}
    </span>
  );
}
