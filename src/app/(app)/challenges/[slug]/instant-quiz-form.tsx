"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, Loader2, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { PublicQuestion } from "@/lib/content/schema";
import type { InstantRun } from "@/lib/submissions/instant";
import { answerSchema } from "@/lib/submissions/input";
import { useReportStarted } from "./collapsible-brief";
import { checkInstantAnswer } from "./instant-actions";
import { QuestionField } from "./question-field";

type Props = {
  slug: string;
  /** Content version the page was rendered from; a check from an older page is refused. */
  version: number;
  /** In this attempt's order (shuffled on the server). */
  questions: PublicQuestion[];
  /** Tries and solved questions so far (from the server), so a refresh carries on where the learner was. */
  initialRun: InstantRun;
  tip?: ReactNode;
  attemptNumber: number;
  /** null for a test attempt (no limit). */
  maxAttempts: number | null;
};

export type Feedback =
  | { kind: "correct"; explanation: string | null; submissionId: string | null }
  | { kind: "wrong" };

const same = (a: string | string[] | undefined, b: string | string[] | undefined) => JSON.stringify(a) === JSON.stringify(b);

/**
 * An instant-feedback quiz: one question at a time. Continue sends that one answer to the server
 * (checkInstantAnswer), which counts the try and says right or wrong; a dialog shows the outcome. Right: the
 * explanation, then the next question. Wrong: no answer and no explanation, back to the same question. The learner
 * moves on only with a right answer. After the last one the attempt is published and the result page opens.
 */
export function InstantQuizForm({ slug, version, questions, initialRun, tip, attemptNumber, maxAttempts }: Props) {
  const router = useRouter();
  const [run, setRun] = useState<InstantRun>(initialRun);
  // The first question not solved yet (all solved but not published: the last, to finish it).
  const firstOpen = (r: InstantRun) => {
    const i = questions.findIndex((q) => !r[q.id]?.solved);
    return i === -1 ? questions.length - 1 : i;
  };
  const [index, setIndex] = useState(() => firstOpen(initialRun));
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  // The last wrong answer per question: sending it again would only cost a try.
  const [wrong, setWrong] = useState<Record<string, string | string[]>>({});
  // The last outcome, kept while the dialog closes (see InstantFeedbackDialog).
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  const q = questions[index];
  const answer = answers[q.id];
  const tries = run[q.id]?.tries ?? 0;
  const solvedCount = questions.filter((x) => run[x.id]?.solved).length;
  const valid = answer !== undefined && answerSchema(q).safeParse(answer).success;
  const repeat = wrong[q.id] !== undefined && same(wrong[q.id], answer);
  const blocker = !valid ? "Answer the question to continue." : repeat ? "Change your answer to try again." : null;

  useReportStarted(solvedCount > 0 || tries > 0 || answer !== undefined);

  function check() {
    if (blocker || pending || answer === undefined) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await checkInstantAnswer(slug, { version, questionId: q.id, answer });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRun((r) => ({ ...r, [q.id]: { tries: (r[q.id]?.solved ? r[q.id].tries : (r[q.id]?.tries ?? 0) + 1), solved: res.correct } }));
        if (res.correct) setFeedback({ kind: "correct", explanation: res.explanation, submissionId: res.submissionId });
        else {
          setWrong((w) => ({ ...w, [q.id]: answer }));
          setFeedback({ kind: "wrong" });
        }
        setOpen(true);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  // Closing the dialog (button, Escape or the close icon) is the same as its button.
  function closeFeedback() {
    if (!open) return;
    setOpen(false);
    const done = feedback;
    if (done?.kind !== "correct") return;
    if (done.submissionId) {
      router.push(`/submissions/${done.submissionId}`);
      return;
    }
    setIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  const headingId = `instant-heading-${q.id}`;

  return (
    <div className="grid gap-4" data-testid="instant-quiz">
      <div className="grid gap-2">
        <div className="text-muted-foreground text-meta flex flex-wrap justify-between gap-x-4">
          <span>
            Question {index + 1} of {questions.length} · {q.points} pts
          </span>
          <span data-testid="instant-progress">
            {solvedCount} of {questions.length} done
          </span>
        </div>
        <Progress value={(solvedCount / questions.length) * 100} aria-label="Questions done" className="h-1.5" />
      </div>

      {index === 0 && tip}

      <div className="grid gap-4" key={q.id}>
        <h3 ref={heading} id={headingId} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          {q.prompt}
        </h3>
        <QuestionField
          q={q}
          index={index}
          value={answer}
          onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
          disabled={pending}
          labelledBy={headingId}
        />
        <p className="text-muted-foreground text-meta" data-testid="instant-scoring">
          {tries === 0
            ? "Full points on the first try, half on the second."
            : tries === 1
              ? "1 try so far: a right answer now earns half points."
              : `${tries} tries so far: a right answer now earns no points, but you need it to go on.`}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {maxAttempts === null ? `Test attempt ${attemptNumber}` : `Attempt ${attemptNumber} of ${maxAttempts}`}
        </p>
        <Button type="button" onClick={check} disabled={Boolean(blocker) || pending} aria-describedby={blocker && !pending ? "instant-blocker" : undefined}>
          {pending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {pending ? "Checking…" : "Continue"}
        </Button>
      </div>
      {blocker && (
        <p id="instant-blocker" className="text-muted-foreground text-meta -mt-2 flex items-start justify-end gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {blocker}
        </p>
      )}

      <InstantFeedbackDialog
        open={open}
        feedback={feedback}
        onClose={closeFeedback}
        // Focus goes to the question's heading: the next question after a right answer, the same one after a wrong
        // answer (Continue, where the learner was, stays disabled until they change their answer).
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          heading.current?.focus();
        }}
      />
    </div>
  );
}

/**
 * The outcome of one check. Right: "Correct!", the explanation and Continue (or "See your result" after the last
 * question). Wrong: "Not quite — try again." and nothing else. `feedback` stays set while the dialog closes, so its
 * text doesn't change during the fade.
 */
export function InstantFeedbackDialog({
  open,
  feedback,
  onClose,
  onCloseAutoFocus,
}: {
  open: boolean;
  feedback: Feedback | null;
  onClose: () => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="motion-reduce:animate-none!"
        data-testid="instant-feedback"
        data-result={feedback?.kind}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {feedback?.kind === "correct" ? (
          <>
            <div className="grid gap-2 pr-6">
              <DialogTitle className="text-success flex items-center gap-2">
                <CheckCircle2 className="size-5" aria-hidden />
                Correct!
              </DialogTitle>
              <DialogDescription className={feedback.explanation ? "text-foreground" : "sr-only"}>
                {feedback.explanation ?? "That's the right answer."}
              </DialogDescription>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose} autoFocus>
                {feedback.submissionId ? "See your result" : "Continue"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="size-5" aria-hidden />
                Not quite — try again.
              </DialogTitle>
              <DialogDescription>Close this to answer the same question again.</DialogDescription>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose} autoFocus>
                Try again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
