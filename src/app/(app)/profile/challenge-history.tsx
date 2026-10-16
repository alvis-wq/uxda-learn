import Link from "next/link";
import { ChevronRight, Clock, RotateCcw, TriangleAlert, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cardCta } from "@/lib/challenges/card";
import {
  ATTEMPT_LABEL,
  isLowScore,
  isResultVisible,
  MAX_ATTEMPTS,
  type AttemptLabel,
  type ChallengeHistory,
  type SubmissionStatus,
} from "@/lib/submissions/rules";
import { cn, formatDate } from "@/lib/utils";

export type HistoryRow = {
  id: string;
  challenge_slug: string;
  attempt: number;
  status: SubmissionStatus;
  final_score: number | null;
  max_score: number;
  feedback: string | null;
  submitted_at: string;
};

const LABEL_STYLE: Record<AttemptLabel, { variant: "default" | "secondary" | "outline" | "destructive"; icon?: typeof Clock }> = {
  best: { variant: "default", icon: Trophy },
  earlier: { variant: "outline" },
  not_counted: { variant: "outline" },
  pending: { variant: "secondary", icon: Clock },
  resubmission: { variant: "destructive", icon: RotateCcw },
};

/** Muted rows: attempts that don't count and need nothing from the learner. */
const MUTED: AttemptLabel[] = ["earlier", "not_counted"];

function AttemptBadge({ label, current }: { label: AttemptLabel; current: boolean }) {
  // A resubmission request only needs action while it's the latest attempt.
  const style = label === "resubmission" && !current ? { variant: "outline" as const, icon: RotateCcw } : LABEL_STYLE[label];
  const Icon = style.icon;
  return (
    <Badge variant={style.variant} data-label={label}>
      {Icon && <Icon aria-hidden />}
      {ATTEMPT_LABEL[label]}
    </Badge>
  );
}

function Score({ row, large = false }: { row: HistoryRow; large?: boolean }) {
  // Scores and feedback are only shown once a human approved or asked for changes.
  if (!isResultVisible(row.status) || row.final_score === null) return null;
  const low = isLowScore(row.final_score, row.max_score);
  const pct = row.max_score > 0 ? Math.round((Number(row.final_score) / Number(row.max_score)) * 100) : 0;
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", large ? "font-semibold" : "text-meta font-medium", low && "text-warning")}
      data-testid="attempt-score"
      data-low={low}
    >
      {low && <TriangleAlert className="size-4" aria-label="Below 50%" />}
      {row.final_score} / {row.max_score}
      <span className={cn("text-meta font-normal", !low && "text-muted-foreground")}>({pct}%)</span>
    </span>
  );
}

function Feedback({ row }: { row: HistoryRow }) {
  if (!row.feedback || !isResultVisible(row.status)) return null;
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground text-meta font-medium">Feedback</p>
      <p className="text-sm whitespace-pre-line">{row.feedback}</p>
    </div>
  );
}

function AttemptLine({ row, current }: { row: HistoryRow & { label: AttemptLabel }; current: boolean }) {
  const muted = MUTED.includes(row.label);
  return (
    <li className={cn("grid gap-2 py-3", muted && "text-muted-foreground")} data-testid="attempt-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/submissions/${row.id}`} className="text-sm hover:underline">
          Attempt {row.attempt} · {formatDate(row.submitted_at)}
        </Link>
        <div className="flex items-center gap-3">
          <Score row={row} />
          <AttemptBadge label={row.label} current={current} />
        </div>
      </div>
      <Feedback row={row} />
    </li>
  );
}

/**
 * "Your challenges": one card per challenge, the attempt that counts on top, the rest collapsible. Completed challenges
 * are no longer on the home page, so each card has the home card's actions: "View result" (or "Continue" when changes
 * were requested) and, where the card would show it, "Try again" straight to the form.
 */
export function ChallengeHistoryList({
  groups,
  titleOf,
  canTryAgain,
}: {
  groups: ChallengeHistory<HistoryRow>[];
  titleOf: (slug: string) => string;
  /** Whether the challenge's card would offer "Try again" (historyTryAgain, and the challenge still published). */
  canTryAgain: (slug: string) => boolean;
}) {
  return (
    <ul className="grid gap-3">
      {groups.map((g) => {
        const { headline } = g;
        const latestAttempt = Math.max(headline.attempt, ...g.others.map((o) => o.attempt));
        // The newest attempt decides the label, as on the home card (`newer` is it when it isn't the headline).
        const cta = cardCta({ type: "quiz", latestStatus: (g.newer ?? headline).status });
        return (
          <li key={g.slug}>
            <Card className="gap-3 py-4" data-testid="challenge-history" data-slug={g.slug}>
              <CardHeader className="flex flex-wrap items-start justify-between gap-2 px-4">
                <div className="grid gap-0.5">
                  <CardTitle className="text-base">
                    <Link href={`/challenges/${g.slug}`} className="hover:underline">
                      {titleOf(g.slug)}
                    </Link>
                  </CardTitle>
                  <p className="text-muted-foreground text-meta">
                    <Link href={`/submissions/${headline.id}`} className="hover:underline">
                      Attempt {headline.attempt}
                    </Link>{" "}
                    · {g.attemptsUsed} of {MAX_ATTEMPTS} attempts used
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Score row={headline} large />
                  <AttemptBadge label={headline.label} current={headline.attempt === latestAttempt} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 px-4">
                {g.newer && (
                  <p className="text-meta flex items-center gap-2" data-testid="newer-attempt">
                    Latest: attempt {g.newer.attempt}
                    <AttemptBadge label={g.newer.label} current />
                  </p>
                )}
                <Feedback row={headline} />
                {g.others.length > 0 && (
                  <details className="group">
                    <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1 text-meta [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
                      {g.others.length === 1 ? "1 other attempt" : `${g.others.length} other attempts`}
                    </summary>
                    <ul className="divide-y border-t mt-2">
                      {g.others.map((o) => (
                        <AttemptLine key={o.id} row={o} current={o.attempt === latestAttempt} />
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap items-center gap-2" data-testid="history-actions">
                  <Link href={`/challenges/${g.slug}`} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")}>
                    {cta}
                    <span className="sr-only"> — {titleOf(g.slug)}</span>
                  </Link>
                  {canTryAgain(g.slug) && (
                    <Link
                      href={`/challenges/${g.slug}#submit`}
                      data-testid="history-try-again"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full px-4")}
                    >
                      Try again
                      <span className="sr-only"> — {titleOf(g.slug)}</span>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export type ConfirmedRow = { slug: string; title: string; acknowledged_at: string };

/** Read & confirm items the learner confirmed: they have no attempts, and are no longer on the home page once done. */
export function ConfirmedList({ items }: { items: ConfirmedRow[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((c) => (
        <li key={c.slug}>
          <Card className="gap-3 py-4" data-testid="confirmed-item" data-slug={c.slug}>
            <CardHeader className="flex flex-wrap items-start justify-between gap-2 px-4">
              <div className="grid gap-0.5">
                <CardTitle className="text-base">
                  <Link href={`/challenges/${c.slug}`} className="hover:underline">
                    {c.title}
                  </Link>
                </CardTitle>
                <p className="text-muted-foreground text-meta">Confirmed {formatDate(c.acknowledged_at)}</p>
              </div>
              <Link href={`/challenges/${c.slug}`} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")}>
                View result
                <span className="sr-only"> — {c.title}</span>
              </Link>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
