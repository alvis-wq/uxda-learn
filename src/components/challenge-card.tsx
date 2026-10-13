import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChallengeMeta } from "@/components/challenge-meta";
import { RequiredBadges } from "@/components/required-badge";
import { StatusBadge } from "@/components/status-badge";
import { cardCta, cardSpans, type CardSpan } from "@/lib/challenges/card";
import type { CardChallenge } from "@/lib/data/learner";
import { cn } from "@/lib/utils";

/** Image column width per card size (see globals.css for the rest): narrower cards shrink the image instead of dropping it. */
const IMAGE_WIDTH: Record<CardSpan, string> = {
  wide: "[--img-w:5rem] md:[--img-w:clamp(8rem,34%,15rem)]",
  full: "[--img-w:5rem] md:[--img-w:clamp(8rem,34%,15rem)]",
  narrow: "[--img-w:5rem] md:[--img-w:clamp(4.5rem,24%,7.5rem)]",
};

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
 * Optional artwork bleeds off the bottom-right corner. It starts at the left edge of its own grid column and grows
 * rightwards and downwards through the card's padding and past its edge, while the text spans only the other column,
 * so text can never sit under the image.
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
  headingLevel: 2 | 3;
  now: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const cta = cardCta({ type: ch.type, acknowledged: ch.acknowledged, latestStatus: ch.latestStatus, inProgress: ch.inProgress });
  const hasImage = Boolean(ch.imageUrl);

  return (
    <article
      data-testid="challenge-card"
      data-span={span}
      data-has-image={hasImage ? "" : undefined}
      className={cn(
        "challenge-card group bg-tile relative isolate flex min-h-64 w-full overflow-hidden rounded-[24px] border p-[var(--pad)] transition-colors [--pad:1.5rem] sm:rounded-[32px] sm:[--pad:2rem]",
        "hover:border-primary has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-[3px]",
        IMAGE_WIDTH[span],
      )}
    >
      <div className={cn("grid min-w-0 flex-1 gap-x-4 sm:gap-x-6", hasImage && "grid-cols-[minmax(0,1fr)_var(--img-w)]")}>
        <div className="flex min-w-0 flex-col gap-4">
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

          <div className="mt-auto grid gap-4 pt-2">
            <span
              aria-hidden
              className="bg-primary text-primary-foreground inline-flex h-10 w-fit items-center gap-2 rounded-full px-5 text-sm font-medium"
            >
              {cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ChallengeMeta challenge={ch} />
              <RequiredBadges required={ch.required} dueAt={ch.due_at} done={ch.done} now={now} />
              <StatusBadge
                status={ch.latestStatus}
                acknowledged={ch.type === "acknowledge" ? ch.acknowledged : undefined}
                inProgress={ch.inProgress}
              />
              {ch.type !== "acknowledge" && ch.bestScore !== null && (
                <span className="text-meta font-medium">
                  Best: {ch.bestScore} / {ch.points}
                </span>
              )}
            </div>
          </div>
        </div>

        {hasImage && (
          <div aria-hidden className="pointer-events-none relative self-stretch">
            {/* eslint-disable-next-line @next/next/no-img-element -- static artwork from public/challenges */}
            <img
              src={ch.imageUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute bottom-[calc(-1*var(--pad)-1rem)] left-0 h-auto w-[calc(100%+var(--pad)+1.25rem)] max-w-none"
            />
          </div>
        )}
      </div>
    </article>
  );
}

/** The two-column (desktop) grid: alternating wide and narrow cards, one column on mobile. */
export function ChallengeCardGrid({
  items,
  headingLevel,
  now,
  detail,
}: {
  items: CardChallenge[];
  headingLevel: 2 | 3;
  now: Date;
  /** What goes under the heading: the category (home) or the summary (category page). */
  detail: "category" | "summary";
}) {
  const spans = cardSpans(items.length);
  return (
    <ul className="grid gap-4 lg:grid-cols-12">
      {items.map((ch, i) => (
        <li key={ch.slug} className={cn("flex", GRID_SPAN[spans[i]])}>
          <ChallengeCard
            challenge={ch}
            span={spans[i]}
            headingLevel={headingLevel}
            now={now}
            subheading={detail === "category" ? ch.categoryTitle : ch.summary}
            body={detail === "category" ? ch.summary : null}
          />
        </li>
      ))}
    </ul>
  );
}
