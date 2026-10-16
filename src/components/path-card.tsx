import Link from "next/link";
import { ArrowRight, FlaskConical, Lock, Route } from "lucide-react";
import { ARTWORK_SIZE, ARTWORK_TEXT_WIDTH, CardArtwork } from "@/components/card-artwork";
import { DraftBadge } from "@/components/draft-badge";
import { RequiredBadges } from "@/components/required-badge";
import { TimeEstimate } from "@/components/time-estimate";
import { Progress } from "@/components/ui/progress";
import type { CardSpan } from "@/lib/challenges/card";
import type { CardPath } from "@/lib/data/learner";
import { pathLockLine, pathProgressLine, TESTER_OPEN_HINT } from "@/lib/paths/progress";
import { cn } from "@/lib/utils";

/**
 * A learning path as one compact card: a small "Path" label, the title, one line of context, one progress line
 * ("2 of 7 · 40/160 pts") with a bar, and the CTA. Same surface as a challenge card; the whole card is the title's
 * link, so its accessible name stays the path title. The milestones themselves are only on the path page. A locked
 * path (`requires`) says what it waits for in place of the CTA; it still opens its page, where nothing can be started.
 * A path in a chain (paths linked by `requires`) says which step it is ("Step 1 of 3"). A tester on a draft sees the
 * same lock, plus "Open as tester": its page lets them open every draft milestone. Its time is its milestones' added up.
 * A required path shows "Required" and its due / overdue badge above the CTA, or above the lock ("Unlocks after …").
 *
 * Optional artwork is a true background in the bottom-right corner, as on a challenge card: the layout is the same
 * with or without it, except that on a full-width card the text block keeps to 60–70% (ARTWORK_TEXT_WIDTH).
 */
export function PathCard({
  path: p,
  span,
  subheading,
  body,
  headingLevel,
  now,
}: {
  path: CardPath;
  /** Its place in the card grid; sets how wide the artwork is. */
  span: CardSpan;
  subheading?: string | null;
  body?: string | null;
  headingLevel: 2 | 3 | 4;
  now?: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const percent = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
  const line = pathProgressLine(p.progress);

  return (
    <article
      data-testid="path-card"
      data-slug={p.slug}
      data-has-image={p.imageUrl ? "" : undefined}
      data-draft={p.isDraft ? "" : undefined}
      className={cn(
        "group @container relative isolate flex w-full min-w-0 flex-col overflow-hidden rounded-[24px] border transition-colors [--pad:1.5rem] sm:rounded-[32px] sm:[--pad:2rem]",
        "hover:border-primary has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-[3px] motion-reduce:transition-none",
        p.isDraft ? "bg-muted border-muted-foreground/50 border-dashed" : "bg-tile",
        ARTWORK_SIZE[span],
      )}
    >
      {p.imageUrl && <CardArtwork src={p.imageUrl} span={span} tuning={p.imageTuning} />}
      <div className="grid min-w-0 flex-1 p-[var(--pad)]">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-muted-foreground text-meta flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Route className="size-4" aria-hidden />
              Path · {p.progress.total} {p.progress.total === 1 ? "milestone" : "milestones"}
            </span>
            {p.chain && (
              <span className="text-foreground bg-background rounded-full border px-2 py-0.5 tabular-nums" data-testid="path-step">
                Step {p.chain.step} of {p.chain.of}
              </span>
            )}
          </p>
          <div className={cn("grid gap-2", p.imageUrl && ARTWORK_TEXT_WIDTH[span])}>
            <Heading className="text-2xl leading-tight font-light tracking-tight sm:text-3xl">
              <Link href={`/paths/${p.slug}`} className="outline-none after:absolute after:inset-0 after:z-10 after:content-['']">
                {p.title}
              </Link>
            </Heading>
            {subheading && <p className="text-brand-text line-clamp-2 font-medium">{subheading}</p>}
          </div>
          {body && <p className={cn("text-muted-foreground line-clamp-2", p.imageUrl && ARTWORK_TEXT_WIDTH[span])}>{body}</p>}
          {p.progress.time && <TimeEstimate time={p.progress.time} className="text-muted-foreground text-meta" />}

          <div className="mt-auto grid gap-2 pt-2">
            <p className="text-meta font-medium tabular-nums" data-testid="path-progress">
              {line}
            </p>
            <Progress value={percent} aria-label={`${p.title}: ${p.progress.done} of ${p.progress.total} milestones done`} />
          </div>
          {/* Required / due: a path's due date is met once every milestone is submitted. Shown next to a lock too. */}
          <RequiredBadges required={p.required} dueAt={p.due_at} done={p.progress.allSubmitted} now={now} />
          <div className="flex flex-wrap items-center gap-2">
            {p.lockedBy ? (
              <>
                <p
                  className="text-muted-foreground bg-background inline-flex min-h-10 w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
                  data-testid="path-locked"
                >
                  <Lock className="size-4 shrink-0" aria-hidden />
                  {pathLockLine({ title: p.lockedBy })}
                </p>
                {p.testerOpen && (
                  <span
                    className="text-foreground inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full border border-dashed px-4 py-2 text-sm font-medium"
                    data-testid="tester-open-hint"
                  >
                    <FlaskConical className="size-4 shrink-0" aria-hidden />
                    {TESTER_OPEN_HINT}
                  </span>
                )}
              </>
            ) : (
              <span
                aria-hidden
                className="bg-primary text-primary-foreground inline-flex h-10 w-fit items-center gap-2 rounded-full px-5 text-sm font-medium"
                data-testid="path-cta"
              >
                {p.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
            )}
            {p.isDraft && <DraftBadge />}
          </div>
        </div>
      </div>
    </article>
  );
}
