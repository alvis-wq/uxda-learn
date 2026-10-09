import { CheckCircle2, Circle, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { learnerStatus, type SubmissionStatus } from "@/lib/submissions/rules";

const ICONS = { idle: Circle, pending: Clock, done: CheckCircle2, action: RotateCcw } as const;
const VARIANTS = { idle: "outline", pending: "secondary", done: "default", action: "destructive" } as const;

export function StatusBadge({ status }: { status: SubmissionStatus | null | undefined }) {
  const { label, tone } = learnerStatus(status);
  const Icon = ICONS[tone];
  return (
    <Badge variant={VARIANTS[tone]} data-status={status ?? "none"}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
