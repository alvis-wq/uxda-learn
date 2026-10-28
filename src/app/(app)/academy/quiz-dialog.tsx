"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PASS_MARK, type PublicAcademyQuestion } from "@/lib/academy/quiz";
import { QuestionField } from "../challenges/[slug]/question-field";
import { getAcademyQuiz, setAcademyDone, submitAcademyQuiz } from "./actions";

type Outcome = { correct: number; total: number; passed: boolean; wrong: string[] };

/**
 * The "Done" switch of one resource. With a quiz, switching it on opens the quiz; it only stays on once the quiz is
 * passed (4 of 5), and done can't be undone. Without a quiz (podcast episodes, for now) it saves straight away and can
 * be switched back.
 */
export function DoneSwitch({ resourceId, title, done, hasQuiz }: { resourceId: string; title: string; done: boolean; hasQuiz: boolean }) {
  const [open, setOpen] = useState(false);
  const id = `done-${resourceId}`;
  if (!hasQuiz) return <PlainDoneSwitch id={id} resourceId={resourceId} title={title} done={done} />;
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={done}
        disabled={done}
        onCheckedChange={(next) => next && setOpen(true)}
        aria-label={done ? `${title}: done` : `Mark ${title} as done`}
        data-testid="done-switch"
      />
      <label htmlFor={id} className="text-meta text-muted-foreground select-none" aria-hidden>
        {done ? "Done" : "Mark done"}
      </label>
      {open && <QuizDialog resourceId={resourceId} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PlainDoneSwitch({ id, resourceId, title, done }: { id: string; resourceId: string; title: string; done: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setChecked(next);
    setError(null);
    start(async () => {
      const res = await setAcademyDone(resourceId, next).catch(() => ({ ok: false as const, error: "Couldn't save that. Please try again." }));
      if (!res.ok) {
        setChecked(!next);
        setError(res.error);
      } else router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Switch
          id={id}
          checked={checked}
          disabled={pending}
          onCheckedChange={change}
          aria-label={checked ? `${title}: done` : `Mark ${title} as done`}
          data-testid="done-switch"
        />
        <label htmlFor={id} className="text-meta text-muted-foreground select-none" aria-hidden>
          {checked ? "Done" : "Mark done"}
        </label>
        {pending && <Loader2 className="text-muted-foreground size-3.5 animate-spin" aria-label="Saving" />}
      </div>
      {error && (
        <p className="text-meta text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function QuizDialog({ resourceId, title, onClose }: { resourceId: string; title: string; onClose: () => void }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<PublicAcademyQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [pending, start] = useTransition();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getAcademyQuiz(resourceId).then(
      (res) => {
        if (!live) return;
        if (res.ok) setQuestions(res.questions);
        else setLoadError(res.error);
      },
      () => live && setLoadError("Couldn't load the quiz. Please try again."),
    );
    return () => {
      live = false;
    };
  }, [resourceId, attempt]);

  function submit() {
    if (!questions) return;
    if (questions.some((q) => !answers[q.id])) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setSubmitError(null);
    start(async () => {
      const res = await submitAcademyQuiz(resourceId, answers);
      if (!res.ok) setSubmitError(res.error);
      else setOutcome(res);
    });
  }

  function tryAgain() {
    // Keep the right answers; clear the wrong ones so they're answered afresh.
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([qid]) => !outcome?.wrong.includes(qid))));
    setOutcome(null);
  }

  function close() {
    if (outcome?.passed) router.refresh();
    onClose();
  }

  const wrong = new Set(outcome && !outcome.passed ? outcome.wrong : []);

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" data-testid="academy-quiz">
        <DialogTitle>Quick check: {title}</DialogTitle>
        <DialogDescription>
          Five questions. Get at least {PASS_MARK} right to mark it done. You can try as often as you like.
        </DialogDescription>

        {loadError ? (
          <div className="grid gap-3">
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : !questions ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading the questions…
          </div>
        ) : outcome?.passed ? (
          <div className="grid justify-items-center gap-3 py-6 text-center" role="status" data-testid="quiz-passed">
            <CheckCircle2 className="text-primary size-10" aria-hidden />
            <p className="font-medium">
              {outcome.correct} of {outcome.total} right. Marked as done.
            </p>
            <Button onClick={close}>Close</Button>
          </div>
        ) : (
          <form
            className="grid gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (outcome) tryAgain();
              else submit();
            }}
          >
            {questions.map((q, i) => {
              const headingId = `${resourceId}-${q.id}-prompt`;
              return (
                <div key={q.id} className="grid gap-3">
                  <p id={headingId} className="font-medium">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {q.prompt}
                  </p>
                  <QuestionField
                    q={q}
                    index={i}
                    labelledBy={headingId}
                    value={answers[q.id]}
                    disabled={pending || !!outcome}
                    onChange={(v) => typeof v === "string" && setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    error={wrong.has(q.id) ? "Not quite." : missing && !answers[q.id] ? "Choose an answer." : undefined}
                  />
                </div>
              );
            })}

            {outcome && (
              <Alert role="status" data-testid="quiz-failed">
                <AlertDescription>
                  {outcome.correct} of {outcome.total} right. You need {PASS_MARK}. Have another look and try again.
                </AlertDescription>
              </Alert>
            )}
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {outcome ? "Try again" : "Check answers"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
