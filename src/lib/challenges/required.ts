import type { SubmissionStatus } from "@/lib/submissions/rules";

/**
 * Required-challenge progress, shared by the learner home page and the admin view.
 *
 * - done:    a published attempt, or acknowledged (acknowledge challenges)
 * - pending: latest attempt is awaiting review (submitted / ai_reviewed) — the learner can't act
 * - overdue: not done, not awaiting review, and due_at has passed
 * - missing: everything else, including "resubmission requested" (the learner must act)
 */
export type RequiredState = "done" | "pending" | "missing" | "overdue";

export const REQUIRED_STATE_LABEL: Record<RequiredState, string> = {
  done: "Done",
  pending: "Awaiting review",
  missing: "Not done",
  overdue: "Overdue",
};

export function requiredState(input: {
  done: boolean;
  latestStatus: SubmissionStatus | null | undefined;
  dueAt: string | null | undefined;
  now: Date;
}): RequiredState {
  if (input.done) return "done";
  if (input.latestStatus === "submitted" || input.latestStatus === "ai_reviewed") return "pending";
  if (input.dueAt && new Date(input.dueAt).getTime() < input.now.getTime()) return "overdue";
  return "missing";
}

export function isOverdue(dueAt: string | null | undefined, done: boolean, now: Date): boolean {
  return !done && !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

/** Required first; otherwise keeps the incoming order (stable sort). */
export function requiredFirst<T extends { required: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.required) - Number(a.required));
}

const STATE_ORDER: Record<RequiredState, number> = { overdue: 0, missing: 1, pending: 2, done: 3 };

/** Outstanding work order: overdue first, then by due date (undated last), then title. */
export function sortByUrgency<T extends { requiredState: RequiredState; due_at: string | null; title: string }>(
  items: T[],
): T[] {
  const due = (d: string | null) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);
  return [...items].sort(
    (a, b) =>
      STATE_ORDER[a.requiredState] - STATE_ORDER[b.requiredState] ||
      due(a.due_at) - due(b.due_at) ||
      a.title.localeCompare(b.title),
  );
}

export function countStates(states: RequiredState[]): Record<RequiredState, number> {
  const counts: Record<RequiredState, number> = { done: 0, pending: 0, missing: 0, overdue: 0 };
  for (const s of states) counts[s]++;
  return counts;
}
