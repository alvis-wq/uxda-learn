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
