"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustReview, reviewSubmission } from "../../actions";

/**
 * The admin's decision on a submission. "review": approve or ask for a resubmission (refused if the learner changed
 * it since `editedAt`). "adjust": change the score and feedback of one already reviewed, keeping its status (audited).
 */
export function ReviewForm({
  submissionId,
  maxScore,
  initialScore,
  initialFeedback,
  mode = "review",
  editedAt = null,
  feedbackRequired = false,
}: {
  submissionId: string;
  maxScore: number;
  initialScore: number;
  initialFeedback: string;
  mode?: "review" | "adjust";
  /** The learner's last edit when the page was loaded (null: never edited). */
  editedAt?: string | null;
  /** Adjusting a resubmission request: the learner must still be told what to change. */
  feedbackRequired?: boolean;
}) {
  const router = useRouter();
  const [score, setScore] = useState(String(initialScore));
  const [feedback, setFeedback] = useState(initialFeedback);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [acting, setActing] = useState<"approve" | "resubmit" | "adjust" | null>(null);

  function act(decision: "approve" | "resubmit" | "adjust") {
    setFormError(null);
    setErrors({});
    setActing(decision);
    startTransition(async () => {
      const res =
        decision === "adjust"
          ? await adjustReview({ submissionId, finalScore: score, feedback })
          : await reviewSubmission({ submissionId, decision, finalScore: score, feedback, editedAt });
      setActing(null);
      if (!res.ok) {
        setFormError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(
        decision === "approve" ? "Approved and published." : decision === "resubmit" ? "Resubmission requested." : "Changes saved.",
      );
      router.refresh();
    });
  }

  return (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-2">
        <Label htmlFor="final-score">Final score (max {maxScore})</Label>
        <Input
          id="final-score"
          type="number"
          inputMode="decimal"
          min={0}
          max={maxScore}
          step={0.5}
          className="w-32"
          value={score}
          disabled={pending}
          aria-invalid={!!errors.finalScore}
          aria-describedby={errors.finalScore ? "score-error" : undefined}
          onChange={(e) => setScore(e.target.value)}
        />
        {errors.finalScore && (
          <p id="score-error" role="alert" className="text-destructive text-sm">
            {errors.finalScore}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="feedback">
          Feedback to the learner
          {mode === "adjust" && !feedbackRequired && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </Label>
        <Textarea
          id="feedback"
          rows={6}
          value={feedback}
          disabled={pending}
          aria-invalid={!!errors.feedback}
          aria-describedby={errors.feedback ? "feedback-error" : undefined}
          onChange={(e) => setFeedback(e.target.value)}
        />
        {errors.feedback && (
          <p id="feedback-error" role="alert" className="text-destructive text-sm">
            {errors.feedback}
          </p>
        )}
      </div>
      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {mode === "adjust" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => act("adjust")}>
            {acting === "adjust" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Save changes
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => act("approve")}>
            {acting === "approve" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            Approve &amp; publish
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => act("resubmit")}>
            {acting === "resubmit" ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
            Request resubmission
          </Button>
        </div>
      )}
    </form>
  );
}
