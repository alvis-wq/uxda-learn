"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_MAX } from "@/lib/feedback";
import { submitFeedback } from "./feedback-actions";

/** "Feedback for Alvis": an optional note a tester can send at any time while a challenge is a draft. */
export function FeedbackForm({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        const res = await submitFeedback(slug, text);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setText("");
        setSent(true);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate data-testid="feedback-form">
      <div className="grid gap-1">
        <Label htmlFor="feedback-text" className="text-lg font-semibold">
          Feedback for Alvis
        </Label>
        <p id="feedback-hint" className="text-muted-foreground text-sm">
          Optional, and you can send it any time: a wrong answer, an unclear question, a typo, anything.
        </p>
      </div>
      <Textarea
        id="feedback-text"
        rows={4}
        value={text}
        maxLength={FEEDBACK_MAX}
        aria-describedby="feedback-hint"
        aria-invalid={!!error}
        disabled={pending}
        onChange={(e) => {
          setText(e.target.value);
          setSent(false);
        }}
      />
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending || text.trim() === ""} className="w-fit">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? "Sending…" : "Send feedback"}
        </Button>
        <p role="status" className="text-sm" data-testid="feedback-status">
          {sent && (
            <span className="text-success inline-flex items-center gap-1">
              <CheckCircle2 className="size-4" aria-hidden />
              Sent — thank you.
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
