import type { RequiredState } from "@/lib/challenges/required";
import { sumTimes, type TimeEstimate } from "@/lib/challenges/time";
import type { AttemptSummary } from "@/lib/submissions/rules";

/**
 * Learning paths: one card that opens a roadmap of milestone challenges. Each milestone is an ordinary challenge
 * (same submit, review and scoring); this module only decides what the roadmap shows and what is unlocked.
 *
 * Unlocking (sequential paths): a milestone opens once the one before it has ANY attempt — awaiting review and
 * changes requested count — so nobody waits on a review to go on. A milestone the learner already has an attempt on
 * is never locked (imported progress can skip ahead). A non-sequential path has nothing locked.
 *
 * Path order (`requires`): a path stays locked, every milestone with it, until each path it requires has an attempt
 * on every milestone (the same rule, one level up). See `blockingPath`.
 *
 * Testers on drafts: a DRAFT milestone a tester is trying (`testing`) ignores both locks, so every step of a draft path
 * can be tried. It still shows as "locked" (what learners will see) but is open (`unlocked`, `testerOverride`). A
 * published milestone follows the locks for everyone, testers included: no skipping ahead for real points.
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
  /** Its time estimate; null (or left out) when it has none. */
  time?: TimeEstimate | null;
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
  /** Its time estimate (hands-on, waiting, total); null when it has none. */
  time: TimeEstimate | null;
  /** 1-based place in the path. */
  position: number;
  /** What a learner sees: "locked" while the locks hold, even when a tester may open it anyway. */
  status: MilestoneStatus;
  /** Whether this viewer can open, save and submit it (checked on the server). */
  unlocked: boolean;
  /** Locked for learners, but open to this tester because it is a draft they are trying. */
  testerOverride: boolean;
  /** Tried as a test (a tester on a draft). */
  testing: boolean;
  /** Best published score (what counts); null when there is none, and always for a test. */
  bestScore: number | null;
  /** Counts as done for the path's "x of y done". */
  done: boolean;
  /** Has any attempt, or saved work. */
  started: boolean;
  /** Has any attempt (awaiting review counts): what unlocks the next milestone, and a path that requires this one. */
  submitted: boolean;
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
    const open = !sequential || i === 0 || m.attempts.length > 0 || previous.attempts.length > 0;
    return {
      slug: m.slug,
      title: m.title,
      points: m.points,
      time: m.time ?? null,
      position: i + 1,
      status: open ? status : "locked",
      unlocked: open || m.testing,
      testerOverride: !open && m.testing,
      testing: m.testing,
      bestScore,
      // Done = a score that counts (a retry awaiting review doesn't undo it); for a test, any attempt.
      done: m.testing ? m.attempts.length > 0 : bestScore !== null,
      started: m.attempts.length > 0 || m.hasDraft,
      submitted: m.attempts.length > 0,
    };
  });
}

/** A path another one requires: its title and the learner's states on the milestones they can see. */
export type RequiredPath = { slug: string; title: string; states: readonly MilestoneState[] };

/** The path a locked path waits for. */
export type PathLock = { slug: string; title: string };

/**
 * Path order: the first path in `requires` that still holds this one back, i.e. one with a milestone that has no
 * attempt yet; null when nothing does. A required path the learner can't see (missing from `required`, or without a
 * visible milestone) holds nothing back, so nobody waits on a draft or archived path. A path the learner already has
 * an attempt in is never locked, like a milestone (imported progress can skip ahead).
 */
export function blockingPath(
  requires: readonly string[],
  required: ReadonlyMap<string, RequiredPath>,
  own: readonly MilestoneState[],
): PathLock | null {
  if (own.some((s) => s.submitted)) return null;
  for (const slug of requires) {
    const p = required.get(slug);
    if (p && p.states.length > 0 && !p.states.every((s) => s.submitted)) return { slug: p.slug, title: p.title };
  }
  return null;
}

/** A locked path's roadmap: every milestone locked (a draft one a tester is trying stays open to them). */
export function lockAll(states: readonly MilestoneState[]): MilestoneState[] {
  return states.map((s) => ({ ...s, status: "locked", unlocked: s.testing, testerOverride: s.testing }));
}

/** The hint next to a lock a tester may open anyway. */
export const TESTER_OPEN_HINT = "Open as tester";

/** "Unlocks after Bring a brand into the template" */
export function pathLockLine(lock: Pick<PathLock, "title">): string {
  return `Unlocks after ${lock.title}`;
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
  /** Every milestone has an attempt: a due date is met (a path is overdue only before that). */
  allSubmitted: boolean;
  /** Its milestones' times added up (the ones that have an estimate); null when none has. */
  time: TimeEstimate | null;
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
    allSubmitted: states.length > 0 && states.every((s) => s.submitted),
    time: sumTimes(states.map((s) => s.time)),
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
  /** Set when the whole path is locked: the path it waits for. */
  lockedBy: PathLock | null;
  /** The next milestone, when there is one. */
  next: { slug: string; title: string } | null;
  /**
   * The path's required / due date, which its milestones inherit (shown on their pages; they never count on their
   * own). `allSubmitted`: every milestone of the path has an attempt, so the due date is met. Set by loadMilestonePlace.
   */
  pathRequirement?: { required: boolean; dueAt: string | null; allSubmitted: boolean };
};

export function milestonePlace(
  path: { slug: string; title: string },
  states: readonly MilestoneState[],
  slug: string,
  lockedBy: PathLock | null = null,
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
    lockedBy: states[i].unlocked ? null : lockedBy,
    next: next ? { slug: next.slug, title: next.title } : null,
  };
}

/** Why a milestone can't be opened or submitted yet; null when it can. */
export function lockReason(place: Pick<MilestonePlace, "locked" | "position" | "lockedBy"> | null): string | null {
  if (!place?.locked) return null;
  return place.lockedBy ? `${pathLockLine(place.lockedBy)}.` : `Submit milestone ${place.position - 1} first.`;
}

/**
 * A required path's state: it counts as ONE required item.
 * - done:    every milestone has a published score
 * - pending: every milestone is submitted, and each one not done yet is awaiting review (the learner can't act)
 * - overdue: past its due date and not every milestone submitted
 * - missing: everything else (including "all submitted, but changes requested on one")
 */
export function requiredPathState(
  states: readonly Pick<MilestoneState, "done" | "submitted" | "status">[],
  dueAt: string | null | undefined,
  now: Date,
): RequiredState {
  if (states.length > 0 && states.every((s) => s.done)) return "done";
  const allSubmitted = states.length > 0 && states.every((s) => s.submitted);
  if (allSubmitted && states.every((s) => s.done || s.status === "awaiting_review")) return "pending";
  if (!allSubmitted && dueAt && new Date(dueAt).getTime() < now.getTime()) return "overdue";
  return "missing";
}
