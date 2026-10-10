import type { Database } from "@/lib/database.types";

export const MAX_ATTEMPTS = 3;

export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

export type AttemptSummary = {
  attempt: number;
  status: SubmissionStatus;
  final_score: number | null;
  max_score: number;
};

export type AttemptState = {
  attemptsUsed: number;
  latest: AttemptSummary | null;
  bestScore: number | null; // best published score, if any
  canSubmit: boolean;
  reason: string | null; // why not, shown to the user
};

/** What the user may do next on a challenge, given their attempts so far. */
export function attemptState(attempts: AttemptSummary[]): AttemptState {
  const sorted = [...attempts].sort((a, b) => a.attempt - b.attempt);
  const latest = sorted.at(-1) ?? null;
  const published = sorted.filter((a) => a.status === "published" && a.final_score !== null);
  const bestScore = published.length ? Math.max(...published.map((a) => Number(a.final_score))) : null;
  const attemptsUsed = sorted.length;

  let reason: string | null = null;
  if (latest && (latest.status === "submitted" || latest.status === "ai_reviewed")) {
    reason = "Your submission is awaiting review.";
  } else if (attemptsUsed >= MAX_ATTEMPTS) {
    reason = `You've used all ${MAX_ATTEMPTS} attempts.`;
  } else if (latest && bestScore !== null && bestScore >= latest.max_score) {
    reason = "You already have full points.";
  }
  return { attemptsUsed, latest, bestScore, canSubmit: reason === null, reason };
}

/** Status as the learner sees it — AI review is internal until an admin approves. */
export function learnerStatus(status: SubmissionStatus | null | undefined) {
  switch (status) {
    case "submitted":
    case "ai_reviewed":
      return { label: "Awaiting review", tone: "pending" as const };
    case "published":
      return { label: "Completed", tone: "done" as const };
    case "needs_resubmission":
      return { label: "Needs resubmission", tone: "action" as const };
    default:
      return { label: "Not started", tone: "idle" as const };
  }
}

/** Feedback and score are only shown once a human has approved (or asked for changes). */
export function isResultVisible(status: SubmissionStatus): boolean {
  return status === "published" || status === "needs_resubmission";
}

/** Dashboard totals. Mirrors get_leaderboard: best published score per challenge. */
export function summarizeScores(
  subs: { challenge_slug: string; status: SubmissionStatus; final_score: number | null }[],
) {
  const best = new Map<string, number>();
  let pending = 0;
  for (const s of subs) {
    if (s.status === "submitted" || s.status === "ai_reviewed") pending++;
    if (s.status === "published" && s.final_score !== null) {
      best.set(s.challenge_slug, Math.max(best.get(s.challenge_slug) ?? 0, Number(s.final_score)));
    }
  }
  return {
    totalScore: [...best.values()].reduce((a, b) => a + b, 0),
    completed: best.size,
    pending,
  };
}

/** Standard competition ranking (1, 2, 2, 4) for an already-sorted score list. */
export function rankRows<T extends { total_score: number }>(rows: T[]): (T & { rank: number })[] {
  return rows.map((r) => ({
    ...r,
    rank: rows.findIndex((x) => Number(x.total_score) === Number(r.total_score)) + 1,
  }));
}

/** How one attempt reads in the learner's history. */
export type AttemptLabel = "best" | "earlier" | "not_counted" | "pending" | "resubmission";

export const ATTEMPT_LABEL: Record<AttemptLabel, string> = {
  best: "Best score",
  earlier: "Earlier attempt",
  not_counted: "Not counted",
  pending: "Awaiting review",
  resubmission: "Resubmission requested",
};

/** Below half the points: shown in the warning colour. */
export function isLowScore(score: number | null, max: number): boolean {
  return score !== null && max > 0 && Number(score) / Number(max) < 0.5;
}

type HistoryAttempt = {
  challenge_slug: string;
  attempt: number;
  status: SubmissionStatus;
  final_score: number | null;
  max_score: number;
  submitted_at: string;
};

export type ChallengeHistory<T extends HistoryAttempt> = {
  slug: string;
  /** The best published attempt (the one that counts), else the latest attempt. */
  headline: T & { label: AttemptLabel };
  /** Every other attempt, newest first. */
  others: (T & { label: AttemptLabel })[];
  /** The newest attempt, when it isn't the headline (e.g. a retry awaiting review). */
  newer: (T & { label: AttemptLabel }) | null;
  /** Score that counts towards totals and the leaderboard, if any. */
  bestScore: number | null;
  attemptsUsed: number;
};

/**
 * Group a learner's attempts per challenge. The best published score counts (ties: the first
 * attempt that reached it — mirrors summarizeScores / get_leaderboard). Other published attempts
 * are "Earlier attempt" when they came before it and "Not counted" when after. Challenges are
 * ordered by their most recent attempt.
 */
export function groupAttemptHistory<T extends HistoryAttempt>(subs: T[]): ChallengeHistory<T>[] {
  const bySlug = new Map<string, T[]>();
  for (const s of subs) bySlug.set(s.challenge_slug, [...(bySlug.get(s.challenge_slug) ?? []), s]);

  const latestAt = (list: T[]) => list.reduce((max, a) => (a.submitted_at > max ? a.submitted_at : max), "");
  const ordered = [...bySlug].sort(([, x], [, y]) => latestAt(y).localeCompare(latestAt(x)));

  return ordered.map(([slug, list]): ChallengeHistory<T> => {
    const sorted = [...list].sort((a, b) => b.attempt - a.attempt); // newest first
    const best = sorted
      .filter((a) => a.status === "published" && a.final_score !== null)
      .reduce<T | null>(
        (top, a) =>
          !top ||
          Number(a.final_score) > Number(top.final_score) ||
          (Number(a.final_score) === Number(top.final_score) && a.attempt < top.attempt)
            ? a
            : top,
        null,
      );
    const label = (a: T): AttemptLabel => {
      if (a.status === "submitted" || a.status === "ai_reviewed") return "pending";
      if (a.status === "needs_resubmission") return "resubmission";
      if (a === best) return "best";
      return best && a.attempt < best.attempt ? "earlier" : "not_counted";
    };
    const labelled = sorted.map((a) => ({ ...a, label: label(a) }));
    const headlineIndex = best ? sorted.indexOf(best) : 0;
    const headline = labelled[headlineIndex];
    return {
      slug,
      headline,
      others: labelled.filter((_, i) => i !== headlineIndex),
      newer: headlineIndex === 0 ? null : labelled[0],
      bestScore: best ? Number(best.final_score) : null,
      attemptsUsed: sorted.length,
    };
  });
}
