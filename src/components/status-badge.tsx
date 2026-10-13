import { CheckCircle2, Circle, Clock, PencilLine, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { learnerStatus, type SubmissionStatus } from "@/lib/submissions/rules";

const ICONS = { idle: Circle, pending: Clock, done: CheckCircle2, action: RotateCcw } as const;
const VARIANTS = { idle: "outline", pending: "secondary", done: "default", action: "destructive" } as const;

function InProgressBadge() {
  return (
    <Badge variant="secondary" data-status="in-progress">
      <PencilLine aria-hidden />
      In progress
    </Badge>
  );
}

/**
 * Learner-facing status. Pass `acknowledged` for acknowledge challenges (no submissions). `inProgress` (saved,
 * unsubmitted work) takes the place of "Not started"; next to any other status (a resubmission, a retry) it is
 * shown as a second badge.
 */
export function StatusBadge({
  status,
  acknowledged,
  inProgress,
}: {
  status?: SubmissionStatus | null;
  acknowledged?: boolean;
  inProgress?: boolean;
}) {
  const { label, tone } =
    acknowledged === undefined
      ? learnerStatus(status)
      : acknowledged
        ? { label: "Acknowledged", tone: "done" as const }
        : { label: "Not started", tone: "idle" as const };
  if (inProgress && tone === "idle") return <InProgressBadge />;
  const Icon = ICONS[tone];
  const badge = (
    <Badge variant={VARIANTS[tone]} data-status={acknowledged ? "acknowledged" : (status ?? "none")}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
  return inProgress ? (
    <>
      {badge}
      <InProgressBadge />
    </>
  ) : (
    badge
  );
}
