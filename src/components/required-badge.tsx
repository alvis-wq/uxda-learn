import { CalendarClock, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isOverdue } from "@/lib/challenges/required";
import { cn, formatDate } from "@/lib/utils";

/**
 * "Required" plus a due / overdue badge. Renders nothing for optional, undated challenges and paths. For a path, `done`
 * is "every milestone submitted": the due date is met then, and it's overdue only before that.
 */
export function RequiredBadges({
  required,
  dueAt,
  done,
  now = new Date(),
  className,
}: {
  required: boolean;
  dueAt: string | null;
  done: boolean;
  now?: Date;
  /** E.g. `contents`, to let the badges join the parent's flex row. */
  className?: string;
}) {
  const overdue = isOverdue(dueAt, done, now);
  if (!required && !(dueAt && !done)) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-2", className)}>
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
