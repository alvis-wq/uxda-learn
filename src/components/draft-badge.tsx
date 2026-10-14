import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Shown to testers on a draft challenge (cards and the challenge page): what they do here is a test, not a real attempt. */
export function DraftBadge() {
  return (
    <Badge variant="outline" className="border-warning text-warning" data-testid="draft-badge">
      <FlaskConical aria-hidden />
      Draft — testing
    </Badge>
  );
}
