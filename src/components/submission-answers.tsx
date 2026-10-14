import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import type { PublicQuestion } from "@/lib/content/schema";
import { tryAgainMessage, type AnswerReveal, type QuestionResult } from "@/lib/submissions/results";

/** Correct / incorrect: colour, icon and text together, never colour alone. */
function ResultMark({ correct }: { correct: boolean }) {
  const Icon = correct ? CheckCircle2 : XCircle;
  return (
    <span
      data-testid="question-mark"
      className={`inline-flex shrink-0 items-center gap-1 text-sm font-medium ${correct ? "text-success" : "text-destructive"}`}
    >
      <Icon className="size-4" aria-hidden />
      {correct ? "Correct" : "Incorrect"}
    </span>
  );
}

/** Read-only view of a submission's answers, screenshots, Figma link and reflection. */
export function SubmissionAnswers({
  questions,
  answers,
  imageUrls,
  figmaUrl,
  reflection,
  results,
  reveal,
}: {
  questions: PublicQuestion[];
  answers: Record<string, unknown>;
  imageUrls: { path: string; url: string | null }[];
  figmaUrl: string | null;
  reflection: string | null;
  /** Marks for the auto-graded questions. The right answers inside are already limited by the server. */
  results?: QuestionResult[];
  reveal?: AnswerReveal;
}) {
  const resultFor = new Map(results?.map((r) => [r.questionId, r]));
  return (
    <div className="grid gap-6">
      {questions.length > 0 && (
        <section className="grid gap-4" aria-label="Answers">
          {questions.map((q, i) => {
            const a = answers[q.id];
            let shown: string;
            if (q.kind === "text") shown = typeof a === "string" ? a : "—";
            else {
              const ids = Array.isArray(a) ? a : typeof a === "string" ? [a] : [];
              shown = ids.map((id) => q.options.find((o) => o.id === id)?.label ?? id).join("; ") || "—";
            }
            const result = q.kind === "text" ? undefined : resultFor.get(q.id);
            const rightAnswer = result?.correctOptionIds
              ?.map((id) => (q.kind === "text" ? id : (q.options.find((o) => o.id === id)?.label ?? id)))
              .join("; ");
            return (
              <div key={q.id} className="grid gap-1" data-testid="answer" data-result={result ? (result.correct ? "correct" : "incorrect") : undefined}>
                <p className="text-sm font-medium">
                  {i + 1}. {q.prompt}
                </p>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <p className="text-muted-foreground min-w-0 flex-1 basis-48 text-sm whitespace-pre-line">{shown}</p>
                  {result && <ResultMark correct={result.correct} />}
                </div>
                {result && !result.correct && rightAnswer && (
                  <p className="text-sm" data-testid="right-answer">
                    <span className="font-medium">{result.correctOptionIds!.length > 1 ? "Correct answers:" : "Correct answer:"}</span>{" "}
                    {rightAnswer}
                  </p>
                )}
                {result && !result.correct && !rightAnswer && reveal && !reveal.reveal && (
                  <p className="text-muted-foreground text-sm" data-testid="try-again">
                    {tryAgainMessage(reveal.attemptsLeft)}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {imageUrls.length > 0 && (
        <section aria-label="Screenshots">
          <h3 className="mb-2 text-sm font-medium">Screenshots</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {imageUrls.map((img, i) => (
              <li key={img.path} className="overflow-hidden rounded-lg border">
                {img.url ? (
                  <a href={img.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img src={img.url} alt={`Screenshot ${i + 1}`} className="w-full object-contain" />
                  </a>
                ) : (
                  <p className="text-muted-foreground p-4 text-sm">Image unavailable</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {figmaUrl && (
        <section aria-label="Figma link">
          <h3 className="mb-1 text-sm font-medium">Figma</h3>
          <a
            href={figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm break-all underline underline-offset-4"
          >
            {figmaUrl}
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        </section>
      )}

      {reflection && (
        <section aria-label="Reflection">
          <h3 className="mb-1 text-sm font-medium">Reflection</h3>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{reflection}</p>
        </section>
      )}
    </div>
  );
}
