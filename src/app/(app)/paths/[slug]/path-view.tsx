import Link from "next/link";
import { ChevronLeft, ClipboardCheck, FlaskConical, Info, Lock, Route } from "lucide-react";
import { DraftBadge } from "@/components/draft-badge";
import { Markdown } from "@/components/markdown";
import { RequiredBadges } from "@/components/required-badge";
import { Roadmap } from "@/components/roadmap";
import { TimeEstimate } from "@/components/time-estimate";
import { SECTION_LABEL_CLASS } from "@/components/section-label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { TESTER_OPEN_HINT, type MilestoneState, type PathLock, type PathSummary } from "@/lib/paths/progress";
import { isTestChallenge } from "@/lib/submissions/testing";

/**
 * A learning path: its progress, then a vertical roadmap of milestones (each an ordinary challenge) joined by a
 * track that fills as they are done, and a short "Before you submit" checklist from the path file. Data-free so it
 * can be rendered on its own. A locked path (`requires`) says which path comes first; every milestone is locked. A
 * required path shows "Required" and its due / overdue badge under the title.
 */
export function PathView({
  path,
  category,
  states,
  summary,
  lockedBy = null,
  required = false,
}: {
  path: {
    title: string;
    summary: string;
    status: string;
    sequential: boolean;
    before_you_start: string | null;
    before_you_submit: string[];
    due_at: string | null;
  };
  category: { slug: string; title: string };
  states: MilestoneState[];
  summary: PathSummary;
  lockedBy?: PathLock | null;
  /** Required for the learner's track (one required item, done when every milestone has a published score). */
  required?: boolean;
}) {
  const testing = isTestChallenge(path.status);
  const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const testerOpen = states.some((s) => s.testerOverride);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-8">
      <div>
        <Link
          href={`/categories/${category.slug}`}
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {category.title}
        </Link>
        <p className={`${SECTION_LABEL_CLASS} mb-2 flex items-center gap-1.5`}>
          <Route className="size-4" aria-hidden />
          Path
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{path.title}</h1>
          {testing && <DraftBadge />}
        </div>
        <p className="text-muted-foreground mt-2 text-lg">{path.summary}</p>
        {summary.time && <TimeEstimate time={summary.time} className="text-muted-foreground text-meta mt-3 flex" />}
        {/* The due date is met once every milestone is submitted. A draft (tester) has no due date. */}
        <RequiredBadges required={required} dueAt={testing ? null : path.due_at} done={summary.allSubmitted} className="mt-3" />
      </div>

      {testing && (
        <Alert data-testid="path-testing-notice">
          <FlaskConical aria-hidden />
          <AlertDescription>
            This path is a draft. Your attempts on its milestones are tests: they don&apos;t count, and they disappear when it&apos;s
            published.
          </AlertDescription>
        </Alert>
      )}

      {lockedBy && (
        <Alert data-testid="path-locked-notice">
          <Lock aria-hidden />
          <AlertDescription>
            <p>
              <span className="text-foreground font-medium">
                Unlocks after{" "}
                <Link href={`/paths/${lockedBy.slug}`} className="underline underline-offset-4">
                  {lockedBy.title}
                </Link>
                .
              </span>{" "}
              Send all its milestones first; waiting for a review is fine.
            </p>
            {testerOpen && (
              <p className="mt-1 inline-flex items-center gap-1.5" data-testid="tester-open-hint">
                <FlaskConical className="size-4 shrink-0" aria-hidden />
                <span>
                  <span className="text-foreground font-medium">{TESTER_OPEN_HINT}:</span> this is what learners see. You can
                  open every draft step anyway.
                </span>
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {path.before_you_start && (
        <aside
          aria-labelledby="before-start-heading"
          className="bg-muted/40 grid gap-2 rounded-lg border px-5 py-4"
          data-testid="before-you-start"
        >
          <h2 id="before-start-heading" className="inline-flex items-center gap-2 font-semibold">
            <Info className="size-4" aria-hidden />
            Before you start
          </h2>
          <Markdown className="prose-sm text-muted-foreground prose-p:my-0 prose-strong:text-foreground prose-strong:whitespace-nowrap">
            {path.before_you_start}
          </Markdown>
        </aside>
      )}

      <section aria-labelledby="path-progress-heading" className="grid gap-3" data-testid="path-progress-summary">
        <h2 id="path-progress-heading" className={SECTION_LABEL_CLASS}>
          Your progress
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl font-light" data-testid="path-done-count">
            {summary.done} of {summary.total} done
          </span>
          {!testing && (
            <span className="text-muted-foreground tabular-nums" data-testid="path-points">
              {summary.pointsEarned} / {summary.pointsPossible} pts
            </span>
          )}
        </p>
        <Progress value={percent} aria-labelledby="path-progress-heading" />
      </section>

      <section aria-labelledby="roadmap-heading" className="grid gap-4">
        <h2 id="roadmap-heading" className={SECTION_LABEL_CLASS}>
          Milestones
        </h2>
        <Roadmap states={states} sequential={path.sequential && !lockedBy} showScores={!testing} />
      </section>

      {path.before_you_submit.length > 0 && (
        <aside
          aria-labelledby="before-submit-heading"
          className="bg-muted/40 grid gap-3 rounded-lg border px-5 py-4"
          data-testid="before-you-submit"
        >
          <h2 id="before-submit-heading" className="inline-flex items-center gap-2 font-semibold">
            <ClipboardCheck className="size-4" aria-hidden />
            Before you submit
          </h2>
          <ul className="text-muted-foreground grid list-disc gap-1 pl-5 text-sm">
            {path.before_you_submit.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}
