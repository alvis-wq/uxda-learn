"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_IMPORT_NOTE, type ImportOutcome } from "@/lib/admin/path-import";
import { importMilestone, undoImport } from "./actions";

/**
 * "Import…" for one milestone: done (counts at once) or changes requested, a score and a note the learner sees as
 * feedback. Opens inline; one save, then it closes.
 */
export function ImportForm({
  userId,
  userName,
  slug,
  title,
  points,
}: {
  userId: string;
  userName: string;
  slug: string;
  title: string;
  points: number;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome>("done");
  const [score, setScore] = useState(String(points));
  const [feedback, setFeedback] = useState(DEFAULT_IMPORT_NOTE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const id = `import-${slug}`;

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="import-open">
        Import…<span className="sr-only"> {title}</span>
      </Button>
    );
  }

  const chooseOutcome = (next: ImportOutcome) => {
    setOutcome(next);
    // Swap the default note for the other outcome's, but keep anything the admin typed.
    if (next === "changes_requested" && feedback === DEFAULT_IMPORT_NOTE) setFeedback("");
    if (next === "done" && feedback === "") setFeedback(DEFAULT_IMPORT_NOTE);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await importMilestone({ userId, slug, outcome, score: score.trim() === "" ? NaN : Number(score), feedback });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(`Imported “${title}” for ${userName}: ${outcome === "done" ? "done" : "changes requested"}, ${score}/${points}.`);
      setOpen(false);
      setErrors({});
    });
  };

  return (
    <form onSubmit={submit} className="bg-muted/40 grid w-full gap-3 rounded-lg border p-3" aria-label={`Import ${title}`} data-testid="import-form">
      <RadioGroup value={outcome} onValueChange={(v) => chooseOutcome(v as ImportOutcome)} className="flex flex-wrap gap-4" aria-label="Result">
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${id}-done`} value="done" />
          <Label htmlFor={`${id}-done`} className="font-normal">
            Done
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${id}-changes`} value="changes_requested" />
          <Label htmlFor={`${id}-changes`} className="font-normal">
            Changes requested
          </Label>
        </div>
      </RadioGroup>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-score`}>Score (out of {points})</Label>
        <Input
          id={`${id}-score`}
          type="number"
          inputMode="numeric"
          min={0}
          max={points}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-28"
          aria-invalid={errors.score ? true : undefined}
          aria-describedby={errors.score ? `${id}-score-error` : undefined}
        />
        {errors.score && (
          <p id={`${id}-score-error`} className="text-destructive text-meta">
            {errors.score}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-feedback`}>{outcome === "done" ? "Note for the learner" : "Feedback: what needs to change"}</Label>
        <Textarea
          id={`${id}-feedback`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          aria-invalid={errors.feedback ? true : undefined}
          aria-describedby={errors.feedback ? `${id}-feedback-error` : undefined}
        />
        {errors.feedback && (
          <p id={`${id}-feedback-error`} className="text-destructive text-meta">
            {errors.feedback}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save import"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Remove an imported attempt (the user's latest). */
export function UndoImportButton({ submissionId, label }: { submissionId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      data-testid="undo-import"
      onClick={() =>
        start(async () => {
          if (!window.confirm(`Undo the import of ${label}? The attempt is removed; the change stays in the history.`)) return;
          const res = await undoImport(submissionId);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Import undone: ${label}.`);
        })
      }
    >
      {pending ? "Undoing…" : "Undo import"}
      <span className="sr-only"> — {label}</span>
    </Button>
  );
}
