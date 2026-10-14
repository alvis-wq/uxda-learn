import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Circle, KeyRound, TriangleAlert } from "lucide-react";
import { ChallengeMeta } from "@/components/challenge-meta";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSettingValue } from "@/lib/admin/challenge-settings";
import { describePlaceholders } from "@/lib/content/placeholders";
import { getChallengePreview } from "@/lib/data/admin-content";
import { audienceLabel } from "@/lib/tracks";
import { formatDateTime } from "@/lib/utils";
import { AuditHistory } from "../audit-history";
import { FeedbackList } from "../feedback-list";

export const metadata: Metadata = { title: "Preview · Content · Admin · UXDA Learn" };

/** Admin-only content review: the brief, every question with its correct answer, rubric and grader notes. */
export default async function AdminChallengePreviewPage({ params }: PageProps<"/admin/content/[slug]">) {
  const { slug } = await params;
  const data = await getChallengePreview(slug);
  if (!data) notFound();
  const { challenge, questions, graderNotes, category, placeholders, history, feedback, testAttempts } = data;
  const spec = challenge.submission_spec;

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8">
      <div>
        <Link
          href="/admin/content"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Content
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{challenge.title}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href={`/challenges/${challenge.slug}`}>Learner view</Link>
          </Button>
        </div>
        <div className="mt-3 grid gap-3">
          <ChallengeMeta challenge={challenge} />
          <dl className="text-meta grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Category</dt>
            <dd>{category?.title ?? challenge.category_slug}</dd>
            <dt className="text-muted-foreground">Audiences</dt>
            <dd>{audienceLabel(challenge.audiences)}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{formatSettingValue("status", challenge.status)}</dd>
            <dt className="text-muted-foreground">Required for</dt>
            <dd>{formatSettingValue("required_for", challenge.required_for)}</dd>
            <dt className="text-muted-foreground">Due date</dt>
            <dd>{formatSettingValue("due_at", challenge.due_at)}</dd>
            <dt className="text-muted-foreground">Version</dt>
            <dd>
              v{challenge.version} · <code>content/challenges/{challenge.slug}.md</code>
            </dd>
          </dl>
        </div>
      </div>

      <Alert>
        <KeyRound aria-hidden />
        <AlertDescription>
          Admin preview with answers and grader notes. Learners never see this page. Change status, required and due
          date on the Content page.
        </AlertDescription>
      </Alert>

      {placeholders.length > 0 && (
        <Alert data-testid="placeholder-warning">
          <TriangleAlert aria-hidden className="text-warning" />
          <AlertDescription>
            Can&apos;t be published yet — placeholders to fill in: {describePlaceholders(placeholders)}.
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="brief-heading" className="grid gap-3">
        <h2 id="brief-heading" className="text-lg font-semibold">
          Brief
        </h2>
        <Markdown>{challenge.body_md}</Markdown>
      </section>

      {questions.length > 0 && (
        <section aria-labelledby="questions-heading" className="grid gap-4">
          <h2 id="questions-heading" className="text-lg font-semibold">
            Questions and answers
          </h2>
          <ol className="grid gap-4">
            {questions.map((q, i) => (
              <li key={q.id} className="grid gap-2 rounded-lg border px-4 py-3" data-testid="preview-question">
                <div className="flex justify-between gap-4">
                  <p className="font-medium">
                    {i + 1}. {q.prompt}
                  </p>
                  <span className="text-muted-foreground text-meta shrink-0">{q.points} pts</span>
                </div>
                {q.kind === "text" ? (
                  <p className="text-muted-foreground text-meta">
                    Free text{q.min_words ? `, at least ${q.min_words} words` : ""} — reviewed against the rubric and
                    grader notes.
                  </p>
                ) : q.kind === "order" ? (
                  <>
                    <p className="text-muted-foreground text-meta">Put in this order (learners see them shuffled)</p>
                    <ol className="grid list-decimal gap-1 pl-5 font-medium" data-testid="preview-order">
                      {(q.correct ?? q.items.map((item) => item.id)).map((itemId) => (
                        <li key={itemId}>{q.items.find((item) => item.id === itemId)?.label ?? itemId}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground text-meta">
                      {q.kind === "single" ? "One correct answer" : "Select all that apply"}
                    </p>
                    <ul className="grid gap-1">
                      {q.options.map((o) => {
                        const correct = !!q.correct?.includes(o.id);
                        return (
                          <li
                            key={o.id}
                            className={correct ? "flex items-start gap-2 font-medium" : "text-muted-foreground flex items-start gap-2"}
                            data-correct={correct}
                          >
                            {correct ? (
                              <CheckCircle2 className="text-foreground mt-1.5 size-4 shrink-0" aria-hidden />
                            ) : (
                              <Circle className="mt-1.5 size-4 shrink-0" aria-hidden />
                            )}
                            <span>
                              {o.label}
                              {correct && (
                                <Badge variant="default" className="ml-2 align-middle">
                                  Correct
                                </Badge>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {!q.correct && <p className="text-warning text-meta">No answer key stored for this question.</p>}
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(spec.screenshots || spec.figma_url || spec.reflection) && (
        <section aria-labelledby="submission-heading" className="grid gap-3">
          <h2 id="submission-heading" className="text-lg font-semibold">
            What learners submit
          </h2>
          <ul className="grid gap-2 text-sm">
            {spec.screenshots && (
              <li>
                Screenshots ({spec.screenshots.min}–{spec.screenshots.max}): {spec.screenshots.label}
              </li>
            )}
            {spec.figma_url && (
              <li>
                Figma link ({spec.figma_url.required ? "required" : "optional"}): {spec.figma_url.label}
              </li>
            )}
            {spec.reflection && (
              <li>
                Reflection ({spec.reflection.required ? "required" : "optional"}
                {spec.reflection.min_words ? `, ${spec.reflection.min_words}+ words` : ""}): {spec.reflection.prompt}
              </li>
            )}
          </ul>
        </section>
      )}

      {challenge.rubric.length > 0 && (
        <section aria-labelledby="rubric-heading" className="grid gap-3">
          <h2 id="rubric-heading" className="text-lg font-semibold">
            Rubric
          </h2>
          <ul className="grid gap-3">
            {challenge.rubric.map((r) => (
              <li key={r.id} className="grid gap-2 rounded-lg border px-4 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-medium">{r.criterion}</span>
                  <span className="text-muted-foreground text-meta shrink-0">{r.points} pts</span>
                </div>
                <dl className="text-meta grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Full</dt>
                  <dd>{r.levels.full}</dd>
                  <dt className="text-muted-foreground">Partial</dt>
                  <dd>{r.levels.partial}</dd>
                  <dt className="text-muted-foreground">None</dt>
                  <dd>{r.levels.none}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      {graderNotes && (
        <section aria-labelledby="notes-heading" className="grid gap-3">
          <h2 id="notes-heading" className="text-lg font-semibold">
            Grader notes
          </h2>
          <p className="bg-muted rounded-lg px-4 py-3 text-sm whitespace-pre-line">{graderNotes}</p>
        </section>
      )}

      <section aria-labelledby="feedback-heading" className="grid gap-3">
        <h2 id="feedback-heading" className="text-lg font-semibold">
          Tester feedback
        </h2>
        <FeedbackList items={feedback} open />
      </section>

      {testAttempts.length > 0 && (
        <section aria-labelledby="tests-heading" className="grid gap-3">
          <h2 id="tests-heading" className="text-lg font-semibold">
            Test attempts
          </h2>
          <p className="text-muted-foreground text-meta">
            Made by testers while this was a draft. They never count towards points, the leaderboard or attempt limits.
          </p>
          <ul className="grid gap-1 text-sm" data-testid="test-attempts">
            {testAttempts.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/submissions/${t.id}`} className="underline underline-offset-4">
                  {t.who} · attempt {t.attempt}
                </Link>{" "}
                <span className="text-muted-foreground text-meta">
                  · {t.score} / {t.max} pts auto-graded · {formatDateTime(t.submitted_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AuditHistory rows={history} open />
    </article>
  );
}
