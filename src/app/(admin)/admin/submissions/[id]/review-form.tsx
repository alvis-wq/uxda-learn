"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewSubmission } from "../../actions";

export function ReviewForm({
  submissionId,
  maxScore,
  initialScore,
  initialFeedback,
}: {
  submissionId: string;
  maxScore: number;
  initialScore: number;
  initialFeedback: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState(String(initialScore));
  const [feedback, setFeedback] = useState(initialFeedback);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [acting, setActing] = useState<"approve" | "resubmit" | null>(null);

  function act(decision: "approve" | "resubmit") {
    setFormError(null);
    setErrors({});
    setActing(decision);
    startTransition(async () => {
      const res = await reviewSubmission({ submissionId, decision, finalScore: score, feedback });
      setActing(null);
      if (!res.ok) {
        setFormError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(decision === "approve" ? "Approved and published." : "Resubmission requested.");
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
        <Label htmlFor="feedback">Feedback to the learner</Label>
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
    </form>
  );
}
