import { type AttemptState, type AttemptSummary } from "./rules";

/**
 * Test attempts: what a tester does on a DRAFT challenge. They are saved as `is_test` submissions, published on the
 * spot (no AI or admin review) and kept entirely apart from real attempts: they never count towards points, the
 * leaderboard, completed counts, required progress or the 3-attempt limit. Everything about them lives here so the
 * rules read in one place.
 */

/** A challenge in this status is tried as a test (only a tester can open one). */
export function isTestChallenge(status: string): boolean {
  return status === "draft";
}

/** What a tester may do next on a draft: always another test attempt (no limit, no "already full points"). */
export function testingState(attempts: AttemptSummary[]): AttemptState {
  const sorted = [...attempts].sort((a, b) => a.attempt - b.attempt);
  return {
    attemptsUsed: sorted.length,
    latest: sorted.at(-1) ?? null,
    bestScore: null, // nothing counts, so there is no "best score"
    canSubmit: true,
    reason: null,
  };
}

/** Test attempts are numbered on their own, 1, 2, 3, ... without a cap. */
export function nextTestAttempt(attempts: { attempt: number }[]): number {
  return attempts.reduce((max, a) => Math.max(max, a.attempt), 0) + 1;
}

/**
 * A test attempt on a challenge with screenshots, Figma or written parts only has its auto-graded questions marked
 * (nobody reviews a test), so a "x / max" total would be misleading: show the notice instead of a score.
 */
export function showsTestTotal(needsReview: boolean): boolean {
  return !needsReview;
}
