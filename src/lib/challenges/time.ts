/**
 * Time estimates. A challenge's `estimated_minutes` is the total; the optional `waiting_minutes` is the part spent
 * waiting while Claude Code works. Hands-on time is the rest: calculated here, never stored.
 */
export type TimeEstimate = { total: number; waiting: number; handsOn: number };

/** A challenge's time, or null when it has no estimate. */
export function timeOf(c: { estimated_minutes: number | null; waiting_minutes?: number | null }): TimeEstimate | null {
  if (!c.estimated_minutes) return null;
  const total = c.estimated_minutes;
  // Validation keeps waiting within the total; clamp anyway so a bad row never shows negative hands-on time.
  const waiting = Math.min(Math.max(c.waiting_minutes ?? 0, 0), total);
  return { total, waiting, handsOn: total - waiting };
}

/** The times added up (a path over its milestones); null when none has an estimate. */
export function sumTimes(times: readonly (TimeEstimate | null)[]): TimeEstimate | null {
  const known = times.filter((t): t is TimeEstimate => t !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, t) => ({ total: sum.total + t.total, waiting: sum.waiting + t.waiting, handsOn: sum.handsOn + t.handsOn }));
}

/** ["~10 min hands-on", "~10 min waiting", "~20 min total"] with waiting time, otherwise ["~20 min"]. */
export function timeParts(t: TimeEstimate): string[] {
  if (t.waiting === 0) return [`~${t.total} min`];
  return [`~${t.handsOn} min hands-on`, `~${t.waiting} min waiting`, `~${t.total} min total`];
}

/** "~10 min hands-on · ~10 min waiting · ~20 min total", or "~20 min". */
export function timeLine(t: TimeEstimate): string {
  return timeParts(t).join(" · ");
}
