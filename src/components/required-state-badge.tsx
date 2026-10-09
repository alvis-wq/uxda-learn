import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REQUIRED_STATE_LABEL, type RequiredState } from "@/lib/challenges/required";

const ICONS = { done: CheckCircle2, pending: Clock, missing: Circle, overdue: AlertTriangle } as const;
const VARIANTS = { done: "default", pending: "secondary", missing: "outline", overdue: "destructive" } as const;

export function RequiredStateBadge({ state }: { state: RequiredState }) {
  const Icon = ICONS[state];
  return (
    <Badge variant={VARIANTS[state]} data-state={state}>
      <Icon aria-hidden />
      {REQUIRED_STATE_LABEL[state]}
    </Badge>
  );
}
