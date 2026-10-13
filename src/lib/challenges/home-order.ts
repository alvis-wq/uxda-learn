import type { RequiredState } from "@/lib/challenges/required";

/** What the home page's "Challenges" list sorts and filters on. */
export type HomeSortable = {
  slug: string;
  title: string;
  categorySlug: string;
  /** The category's place in the category order, then difficulty, order the not-started and completed groups. */
  categoryOrder: number;
  difficulty: number;
  inProgress: boolean;
  /** When the draft was last saved (ISO); null without one. */
  savedAt: string | null;
  required: boolean;
  done: boolean;
  requiredState: RequiredState;
  due_at: string | null;
};

/** 0 in progress · 1 required, not done · 2 everything else not done · 3 completed. */
export function homeGroup(c: Pick<HomeSortable, "inProgress" | "required" | "done">): 0 | 1 | 2 | 3 {
  if (c.inProgress) return 0;
  if (c.required && !c.done) return 1;
  return c.done ? 3 : 2;
}

const STATE_ORDER: Record<RequiredState, number> = { overdue: 0, missing: 1, pending: 2, done: 3 };
const time = (d: string | null) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);

/**
 * The order of the home page's challenge list:
 *  1. in progress, most recently saved first (a required one stays here, with its Required badge);
 *  2. required and not done: overdue first, then by due date (undated last);
 *  3. other challenges not started, in category order, easiest first;
 *  4. completed, last.
 * The order does not depend on the category filter: filtering keeps it.
 */
export function sortHomeChallenges<T extends HomeSortable>(items: readonly T[]): T[] {
  const byCatalogue = (a: T, b: T) =>
    a.categoryOrder - b.categoryOrder || a.difficulty - b.difficulty || a.title.localeCompare(b.title);
  return [...items].sort((a, b) => {
    const [ga, gb] = [homeGroup(a), homeGroup(b)];
    if (ga !== gb) return ga - gb;
    if (ga === 0) return (b.savedAt ?? "").localeCompare(a.savedAt ?? "") || byCatalogue(a, b);
    if (ga === 1) {
      return STATE_ORDER[a.requiredState] - STATE_ORDER[b.requiredState] || time(a.due_at) - time(b.due_at) || a.title.localeCompare(b.title);
    }
    return byCatalogue(a, b);
  });
}

/** The URL param of the "All" filter being absent. */
export const ALL_CATEGORIES = "all";

/** The category a `?category=` value selects: a known slug, else "all" (missing, unknown or repeated values). */
export function parseCategoryFilter(value: string | null | undefined, slugs: readonly string[]): string {
  return value && slugs.includes(value) ? value : ALL_CATEGORIES;
}

export function filterByCategory<T extends { categorySlug: string }>(items: readonly T[], category: string): T[] {
  return category === ALL_CATEGORIES ? [...items] : items.filter((c) => c.categorySlug === category);
}
