import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ARTWORK_CLEARANCE, ARTWORK_SIZE, ARTWORK_VARS, CardArtwork } from "@/components/card-artwork";
import { ChallengeMeta } from "@/components/challenge-meta";
import { DraftBadge } from "@/components/draft-badge";
import { DraftProgressBar } from "@/components/draft-progress";
import { PathCard } from "@/components/path-card";
import { RequiredBadges } from "@/components/required-badge";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cardCta, isPathCard, listSpans, showTryAgain, type CardSpan } from "@/lib/challenges/card";
import type { CardChallenge, HomeCard } from "@/lib/data/learner";
import { cn } from "@/lib/utils";

const GRID_SPAN: Record<CardSpan, string> = {
  wide: "lg:col-span-7",
  narrow: "lg:col-span-5",
  full: "lg:col-span-12",
};

/**
 * A challenge as a card: near-black surface (light surface in light mode), large light heading, lavender
 * subheading, muted body, a violet CTA pill and a compact meta row. The whole card is one link (the heading's), so the
 * accessible name stays the challenge title; the CTA is decoration for that link.
 *
 * Optional artwork is a background layer in the bottom-right corner (CardArtwork). Everything else (text, buttons, meta
 * rows, badges) keeps to the left of it (ARTWORK_CLEARANCE), so nothing runs over the illustration.
 */
export function ChallengeCard({
  challenge: ch,
  span,
  subheading,
  body,
  headingLevel,
  now,
}: {
  challenge: CardChallenge;
  span: CardSpan;
  /** Lavender line under the heading: the category (home) or the summary (category page). */
  subheading?: string | null;
  /** Muted paragraph (the summary on the home page). */
  body?: string | null;
  headingLevel: 2 | 3 | 4;
  now: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const cta = cardCta({ type: ch.type, acknowledged: ch.acknowledged, latestStatus: ch.latestStatus, inProgress: ch.inProgress });
  const tryAgain = showTryAgain(cta, ch.canRetry);
  const hasImage = Boolean(ch.imageUrl);

  return (
    <article
      data-testid="challenge-card"
      data-span={span}
      data-has-image={hasImage ? "" : undefined}
      data-draft={ch.isDraft ? "" : undefined}
      className={cn(
        "challenge-card group @container relative isolate flex min-h-64 w-full min-w-0 flex-col overflow-hidden rounded-[24px] border transition-colors [--pad:1.5rem] sm:rounded-[32px] sm:[--pad:2rem]",
        "hover:border-primary has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-[3px]",
        // A draft a tester can try: dashed border and a muted surface, so it can't be mistaken for a real challenge.
        ch.isDraft ? "bg-muted border-muted-foreground/50 border-dashed" : "bg-tile",
        ARTWORK_VARS,
        ARTWORK_SIZE[span],
      )}
    >
      {ch.imageUrl && <CardArtwork src={ch.imageUrl} span={span} />}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-4 p-[var(--pad)]", hasImage && ARTWORK_CLEARANCE)}>
        <div className="grid gap-2">
          <Heading className="text-2xl leading-tight font-light tracking-tight sm:text-3xl">
            <Link
              href={`/challenges/${ch.slug}`}
              className="outline-none after:absolute after:inset-0 after:z-10 after:content-['']"
            >
              {ch.title}
            </Link>
          </Heading>
          {subheading && <p className="text-brand-text line-clamp-2 font-medium">{subheading}</p>}
        </div>
        {body && <p className="text-muted-foreground line-clamp-3">{body}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground inline-flex h-10 w-fit items-center gap-2 rounded-full px-5 text-sm font-medium"
          >
            {cta}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
          {tryAgain && (
            // A real link above the card-wide one (z-20 over its z-10): same page, but straight to the form.
            <Link
              href={`/challenges/${ch.slug}#submit`}
              data-testid="card-try-again"
              className={cn(buttonVariants({ variant: "outline" }), "relative z-20 h-10 px-5")}
            >
              Try again
              <span className="sr-only"> — {ch.title}</span>
            </Link>
          )}
        </div>

        {/* Always two rows: 1) what it is, 2) where the learner stands. Not positioned, so the waiting-time info
            button (z-20) sits above the card-wide link (z-10). */}
        <div className="grid gap-2 pt-1" data-testid="card-meta">
          <ChallengeMeta challenge={ch} compact />
          <div className="flex flex-wrap items-center gap-2" data-testid="card-badges">
            {ch.isDraft && <DraftBadge />}
            <RequiredBadges required={ch.required} dueAt={ch.due_at} done={ch.done} now={now} className="contents" />
            <StatusBadge
              status={ch.latestStatus}
              acknowledged={ch.type === "acknowledge" ? ch.acknowledged : undefined}
              inProgress={ch.inProgress}
            />
            {ch.draftProgress && <DraftProgressBar progress={ch.draftProgress} inline />}
            {ch.type !== "acknowledge" && ch.bestScore !== null && (
              <span className="text-meta font-medium">
                Best: {ch.bestScore} / {ch.points}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** The two-column (desktop) grid: alternating wide and narrow cards, one column on mobile. A path is its compact card. */
export function ChallengeCardGrid({
  items,
  headingLevel,
  now,
  detail,
}: {
  items: HomeCard[];
  headingLevel: 2 | 3 | 4;
  now: Date;
  /** What goes under the heading: the category (home) or the summary (category page). */
  detail: "category" | "summary";
}) {
  // A chain of paths (grouped by the server, groupChains) runs full width, one card under the other.
  const spans = listSpans(items.map((ch) => isPathCard(ch) && ch.chain !== null));
  return (
    <ul className="grid gap-4 lg:grid-cols-12">
      {items.map((ch, i) => (
        <li key={`${ch.kind ?? "challenge"}-${ch.slug}`} className={cn("flex min-w-0", GRID_SPAN[spans[i]])}>
          {isPathCard(ch) ? (
            <PathCard
              path={ch}
              span={spans[i]}
              headingLevel={headingLevel}
              subheading={detail === "category" ? ch.categoryTitle : ch.summary}
              body={detail === "category" ? ch.summary : null}
              now={now}
            />
          ) : (
          <ChallengeCard
            challenge={ch}
            span={spans[i]}
            headingLevel={headingLevel}
            now={now}
            subheading={detail === "category" ? ch.categoryTitle : ch.summary}
            body={detail === "category" ? ch.summary : null}
          />
          )}
        </li>
      ))}
    </ul>
  );
}
