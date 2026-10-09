import { CheckCircle2, Circle, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { learnerStatus, type SubmissionStatus } from "@/lib/submissions/rules";

const ICONS = { idle: Circle, pending: Clock, done: CheckCircle2, action: RotateCcw } as const;
const VARIANTS = { idle: "outline", pending: "secondary", done: "default", action: "destructive" } as const;

/** Learner-facing status. Pass `acknowledged` for acknowledge challenges (no submissions). */
export function StatusBadge({
  status,
  acknowledged,
}: {
  status?: SubmissionStatus | null;
  acknowledged?: boolean;
}) {
  const { label, tone } =
    acknowledged === undefined
      ? learnerStatus(status)
      : acknowledged
        ? { label: "Acknowledged", tone: "done" as const }
        : { label: "Not started", tone: "idle" as const };
  const Icon = ICONS[tone];
  return (
    <Badge variant={VARIANTS[tone]} data-status={acknowledged ? "acknowledged" : (status ?? "none")}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
