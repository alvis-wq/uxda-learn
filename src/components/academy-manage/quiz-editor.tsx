"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { draftQuizWithAI, markQuizReviewed, saveQuiz } from "@/lib/academy/manage-actions";
import { OPTION_COUNT, PASS_MARK, QUIZ_LENGTH, type QuizDraft } from "@/lib/academy/quiz";

const blank = (): QuizDraft => Array.from({ length: QUIZ_LENGTH }, () => ({ prompt: "", options: Array(OPTION_COUNT).fill(""), answer: 0 }));

/**
 * The 5 questions of a resource. "Draft with AI" asks Claude for a draft (nothing is saved until "Save quiz"); the
 * editor can change every question, option and right answer. Saving marks the quiz as checked.
 */
export function QuizEditor({ id, quiz, reviewed }: { id: string; quiz: QuizDraft | null; reviewed: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>(quiz ?? blank());
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [saving, startSave] = useTransition();
  const busy = drafting || saving;
  const complete = draft.every((q) => q.prompt.trim() && q.options.every((o) => o.trim()));

  function update(i: number, fn: (q: QuizDraft[number]) => QuizDraft[number]) {
    setDraft((d) => d.map((q, k) => (k === i ? fn(q) : q)));
    setDirty(true);
  }

  function aiDraft() {
    if (dirty && !window.confirm("Replace the questions here with a new draft?")) return;
    setError(null);
    startDraft(async () => {
      const res = await draftQuizWithAI(id);
      if (!res.ok) setError(res.error);
      else {
        setDraft(res.data.quiz);
        setDirty(true);
        toast.success("Drafted. Check every question and the right answers, then save.");
      }
    });
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveQuiz(id, draft);
      if (!res.ok) setError(res.error);
      else {
        setDirty(false);
        toast.success("Quiz saved.");
        router.refresh();
      }
    });
  }

  function confirmChecked() {
    startSave(async () => {
      const res = await markQuizReviewed(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Marked as checked.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5" data-testid="quiz-editor">
      <div className="flex flex-wrap items-center gap-2">
        {!quiz ? <Badge variant="destructive">No quiz yet</Badge> : reviewed ? <Badge variant="outline">Checked</Badge> : <Badge variant="secondary">Drafted by Claude, not checked yet</Badge>}
        <p className="text-muted-foreground text-sm">
          {QUIZ_LENGTH} questions, {OPTION_COUNT} options each. {PASS_MARK} right marks it done. Options are shuffled for learners.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={aiDraft} disabled={busy}>
          {drafting ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {drafting ? "Drafting… (up to a minute)" : quiz || dirty ? "Redraft with AI" : "Draft with AI"}
        </Button>
        {quiz && !reviewed && !dirty && (
          <Button type="button" variant="ghost" onClick={confirmChecked} disabled={busy}>
            <CheckCircle2 aria-hidden />
            Looks right, mark as checked
          </Button>
        )}
      </div>

      <ol className="grid gap-6">
        {draft.map((q, i) => (
          <li key={i} className="grid gap-3 rounded-xl border p-4" data-testid="quiz-question">
            <div className="grid gap-2">
              <Label htmlFor={`q${i}-prompt`}>Question {i + 1}</Label>
              <Input id={`q${i}-prompt`} value={q.prompt} maxLength={300} onChange={(e) => update(i, (x) => ({ ...x, prompt: e.target.value }))} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-muted-foreground text-meta mb-1">Options (choose the right one)</legend>
              <RadioGroup value={String(q.answer)} onValueChange={(v) => update(i, (x) => ({ ...x, answer: Number(v) }))} className="gap-2">
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-3">
                    <RadioGroupItem value={String(k)} id={`q${i}-right-${k}`} aria-label={`Option ${k + 1} is the right answer`} />
                    <Input
                      aria-label={`Question ${i + 1}, option ${k + 1}`}
                      value={o}
                      maxLength={200}
                      onChange={(e) => update(i, (x) => ({ ...x, options: x.options.map((v, j) => (j === k ? e.target.value : v)) }))}
                    />
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          </li>
        ))}
      </ol>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button type="button" onClick={save} disabled={busy || !complete || (!dirty && !!quiz)}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Save quiz
        </Button>
        {!complete && <p className="text-muted-foreground text-meta mt-2">Fill in every question and option to save.</p>}
      </div>
    </div>
  );
}
