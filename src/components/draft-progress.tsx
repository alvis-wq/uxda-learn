import type { DraftProgress } from "@/lib/challenges/draft-progress";
import { cn } from "@/lib/utils";

/**
 * "Step 2 of 5" with a segmented bar in the Stepper's own style (4px bars, 6px apart, the primary colour on the input
 * track), the steps up to the current one filled like the Stepper fills them. The text carries the meaning; the bar
 * is decoration.
 */
export function DraftProgressBar({ progress, className }: { progress: DraftProgress; className?: string }) {
  return (
    <div data-testid="draft-progress" className={cn("grid max-w-56 gap-1.5", className)}>
      <p className="text-muted-foreground text-meta">
        Step {progress.step} of {progress.total}
      </p>
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: progress.total }, (_, i) => (
          <span key={i} data-filled={i < progress.step ? "" : undefined} className="bg-input data-[filled]:bg-primary h-1 flex-1 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
