import type { AttemptSummary } from "@/lib/submissions/rules";

/**
 * Learning paths: one card that opens a roadmap of milestone challenges. Each milestone is an ordinary challenge
 * (same submit, review and scoring); this module only decides what the roadmap shows and what is unlocked.
 *
 * Unlocking (sequential paths): a milestone opens once the one before it has ANY attempt — awaiting review and
 * changes requested count — so nobody waits on a review to go on. A milestone the learner already has an attempt on
 * is never locked (imported progress can skip ahead). A non-sequential path has nothing locked.
 */

export type MilestoneStatus = "locked" | "not_started" | "in_progress" | "awaiting_review" | "changes_requested" | "done";

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  locked: "Locked",
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_review: "Awaiting review",
  changes_requested: "Changes requested",
  done: "Done",
};

export type MilestoneInput = {
  slug: string;
  title: string;
  points: number;
  /** The learner's attempts on it: real ones, or test ones while it is a draft a tester is trying. */
  attempts: AttemptSummary[];
  /** Tried as a test (a tester on a draft): any attempt is "done", and nothing has a score. */
  testing: boolean;
  /** Saved, unsubmitted work. */
  hasDraft: boolean;
};

export type MilestoneState = {
  slug: string;
  title: string;
  points: number;
  /** 1-based place in the path. */
  position: number;
  status: MilestoneStatus;
  unlocked: boolean;
  /** Best published score (what counts); null when there is none, and always for a test. */
  bestScore: number | null;
  /** Counts as done for the path's "x of y done". */
  done: boolean;
  /** Has any attempt, or saved work. */
  started: boolean;
};

function statusOf(m: MilestoneInput, bestScore: number | null): Exclude<MilestoneStatus, "locked"> {
  const latest = [...m.attempts].sort((a, b) => b.attempt - a.attempt)[0];
  if (latest && (latest.status === "submitted" || latest.status === "ai_reviewed")) return "awaiting_review";
  if (m.testing ? latest !== undefined : bestScore !== null) return "done";
  if (latest?.status === "needs_resubmission") return "changes_requested";
  return m.hasDraft ? "in_progress" : "not_started";
}

function bestOf(m: MilestoneInput): number | null {
  if (m.testing) return null;
  const scores = m.attempts.filter((a) => a.status === "published" && a.final_score !== null).map((a) => Number(a.final_score));
  return scores.length ? Math.max(...scores) : null;
}

/** The roadmap: every milestone's status, in path order. */
export function milestoneStates(sequential: boolean, milestones: readonly MilestoneInput[]): MilestoneState[] {
  return milestones.map((m, i) => {
    const bestScore = bestOf(m);
    const status = statusOf(m, bestScore);
    const previous = milestones[i - 1];
    const unlocked = !sequential || i === 0 || m.attempts.length > 0 || previous.attempts.length > 0;
    return {
      slug: m.slug,
      title: m.title,
      points: m.points,
      position: i + 1,
      status: unlocked ? status : "locked",
      unlocked,
      bestScore,
      // Done = a score that counts (a retry awaiting review doesn't undo it); for a test, any attempt.
      done: m.testing ? m.attempts.length > 0 : bestScore !== null,
      started: m.attempts.length > 0 || m.hasDraft,
    };
  });
}

export type PathSummary = {
  done: number;
  total: number;
  /** Sum of the best published scores of its milestones. */
  pointsEarned: number;
  /** Sum of its milestones' points: a path has no points of its own. */
  pointsPossible: number;
  started: boolean;
  /** Every milestone done. */
  complete: boolean;
};

export function summarizePath(states: readonly MilestoneState[]): PathSummary {
  const done = states.filter((s) => s.done).length;
  return {
    done,
    total: states.length,
    pointsEarned: states.reduce((sum, s) => sum + (s.bestScore ?? 0), 0),
    pointsPossible: states.reduce((sum, s) => sum + s.points, 0),
    started: states.some((s) => s.started),
    complete: states.length > 0 && done === states.length,
  };
}

/** The path card's call to action. */
export function pathCta(summary: Pick<PathSummary, "started" | "complete">): "Start" | "Continue" | "View" {
  if (summary.complete) return "View";
  return summary.started ? "Continue" : "Start";
}

/** "2 of 7 · 40/160 pts" */
export function pathProgressLine(summary: PathSummary): string {
  return `${summary.done} of ${summary.total} · ${summary.pointsEarned}/${summary.pointsPossible} pts`;
}

/** Where a milestone sits in its path, for its challenge page. */
export type MilestonePlace = {
  pathSlug: string;
  pathTitle: string;
  position: number;
  total: number;
  locked: boolean;
  /** The next milestone, when there is one. */
  next: { slug: string; title: string } | null;
};

export function milestonePlace(
  path: { slug: string; title: string },
  states: readonly MilestoneState[],
  slug: string,
): MilestonePlace | null {
  const i = states.findIndex((s) => s.slug === slug);
  if (i < 0) return null;
  const next = states[i + 1];
  return {
    pathSlug: path.slug,
    pathTitle: path.title,
    position: i + 1,
    total: states.length,
    locked: !states[i].unlocked,
    next: next ? { slug: next.slug, title: next.title } : null,
  };
}

/** Why a milestone can't be opened or submitted yet; null when it can. */
export function lockReason(place: Pick<MilestonePlace, "locked" | "position"> | null): string | null {
  return place?.locked ? `Submit milestone ${place.position - 1} first.` : null;
}
