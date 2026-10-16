import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { choicesOf, parseMatchPairs, type PublicQuestion } from "@/lib/content/schema";
import { tryLabel } from "@/lib/submissions/instant";
import { tryAgainMessage, type AnswerReveal, type QuestionResult } from "@/lib/submissions/results";

/** An order answer, one item per line with its position. */
function NumberedItems({ labels }: { labels: string[] }) {
  return (
    <ol className="mt-1 grid list-decimal gap-0.5 pl-5">
      {labels.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ol>
  );
}

/** A match answer: each item with the category it was put on, in the question's item order. */
function MatchedItems({ q, pairs }: { q: Extract<PublicQuestion, { kind: "match" }>; pairs: string[] }) {
  const placed = parseMatchPairs(pairs);
  return (
    <ul className="mt-1 grid gap-0.5">
      {q.items.map((item) => (
        <li key={item.id}>
          {item.label} → {q.categories.find((c) => c.id === placed.get(item.id))?.label ?? "not placed"}
        </li>
      ))}
    </ul>
  );
}

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
            const choices = choicesOf(q);
            const label = (id: string) => choices?.find((o) => o.id === id)?.label ?? id;
            const ids = Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : typeof a === "string" ? [a] : [];
            let shown: ReactNode;
            if (q.kind === "text") shown = typeof a === "string" ? a : "—";
            else if (q.kind === "order") shown = ids.length ? <NumberedItems labels={ids.map(label)} /> : "—";
            else if (q.kind === "match") shown = ids.length ? <MatchedItems q={q} pairs={ids} /> : "—";
            else shown = ids.map(label).join("; ") || "—";
            const result = q.kind === "text" ? undefined : resultFor.get(q.id);
            const rightIds = result?.correctOptionIds ?? null;
            const rightAnswer = rightIds
              ? q.kind === "order"
                ? <NumberedItems labels={rightIds.map(label)} />
                : q.kind === "match"
                  ? <MatchedItems q={q} pairs={rightIds} />
                  : rightIds.map(label).join("; ")
              : null;
            const rightTitle =
              q.kind === "order" ? "Correct order:" : q.kind === "match" ? "Correct matches:" : rightIds && rightIds.length > 1 ? "Correct answers:" : "Correct answer:";
            return (
              <div key={q.id} className="grid gap-1" data-testid="answer" data-result={result ? (result.correct ? "correct" : "incorrect") : undefined}>
                <p className="text-sm font-medium">
                  {i + 1}. {q.prompt}
                </p>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="text-muted-foreground min-w-0 flex-1 basis-48 text-sm whitespace-pre-line">{shown}</div>
                  {result && <ResultMark correct={result.correct} />}
                </div>
                {result?.instant && (
                  <p className="text-muted-foreground text-meta" data-testid="question-tries">
                    {tryLabel(result.instant.tries)} · {result.instant.points} / {result.instant.max} pts
                  </p>
                )}
                {result && !result.correct && rightAnswer && (
                  <div className="text-sm" data-testid="right-answer">
                    <span className="font-medium">{rightTitle}</span> {rightAnswer}
                  </div>
                )}
                {result && !result.correct && !rightAnswer && reveal && !reveal.reveal && (
                  <p className="text-muted-foreground text-sm" data-testid="try-again">
                    {tryAgainMessage(reveal.attemptsLeft)}
                  </p>
                )}
                {result?.explanation && (
                  <p className="text-muted-foreground text-sm" data-testid="explanation">
                    <span className="text-foreground font-medium">Why:</span> {result.explanation}
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
