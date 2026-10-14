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

/** A path's place in its chain: paths linked by `requires` (either way), in unlock order. */
export type ChainPlace = {
  /** The chain's first path (step 1). */
  id: string;
  /** 1-based. */
  step: number;
  of: number;
};

/**
 * Chains of paths: paths linked by `requires` (directly or through others) form one chain, ordered so that every path
 * comes after the paths it requires (ties keep the input order). Only links between the given paths count, so pass the
 * paths the learner can see. A path on its own is in no chain.
 */
export function pathChains(paths: readonly { slug: string; requires: readonly string[] }[]): Map<string, ChainPlace> {
  const index = new Map(paths.map((p, i) => [p.slug, i]));
  const root = paths.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const edges = paths.flatMap((p, i) =>
    p.requires.filter((r) => r !== p.slug && index.has(r)).map((r) => [index.get(r)!, i] as const),
  );
  for (const [a, b] of edges) root[find(a)] = find(b);

  const members = new Map<number, number[]>();
  paths.forEach((_, i) => members.set(find(i), [...(members.get(find(i)) ?? []), i]));
  const places = new Map<string, ChainPlace>();
  for (const group of members.values()) {
    if (group.length < 2) continue;
    // Kahn's order, always taking the earliest path whose required paths are all placed (a loop, which content:validate
    // rules out, would end up in input order).
    const pending = new Set(group);
    const order: number[] = [];
    while (pending.size) {
      const next =
        [...pending].find((i) => !edges.some(([a, b]) => b === i && pending.has(a))) ?? Math.min(...pending);
      order.push(next);
      pending.delete(next);
    }
    const id = paths[order[0]].slug;
    order.forEach((i, n) => places.set(paths[i].slug, { id, step: n + 1, of: order.length }));
  }
  return places;
}

/**
 * A chain's cards together, in step order, placed where its first path (the lowest step in the list) sorts; every other
 * card keeps its place. Works on any already-sorted list (All, a category, the drafts).
 */
export function groupChains<T>(items: readonly T[], chainOf: (item: T) => ChainPlace | null): T[] {
  const chains = new Map<string, T[]>();
  for (const item of items) {
    const c = chainOf(item);
    if (c) chains.set(c.id, [...(chains.get(c.id) ?? []), item]);
  }
  for (const list of chains.values()) list.sort((a, b) => chainOf(a)!.step - chainOf(b)!.step);
  return items.flatMap((item) => {
    const c = chainOf(item);
    if (!c) return [item];
    const list = chains.get(c.id)!;
    return list[0] === item ? list : [];
  });
}

/** The URL param of the "All" filter being absent. */
export const ALL_CATEGORIES = "all";

/** The tester-only filter that lists draft challenges (`?category=drafts`). */
export const DRAFTS_FILTER = "drafts";

/**
 * The filter a `?category=` value selects: a known category slug, the drafts filter (testers only), else "all"
 * (missing, unknown or repeated values, or `drafts` for someone who isn't a tester).
 */
export function parseHomeFilter(
  value: string | null | undefined,
  slugs: readonly string[],
  options: { tester: boolean },
): string {
  if (value === DRAFTS_FILTER && options.tester) return DRAFTS_FILTER;
  return value && slugs.includes(value) ? value : ALL_CATEGORIES;
}

export function filterByCategory<T extends { categorySlug: string }>(items: readonly T[], category: string): T[] {
  return category === ALL_CATEGORIES ? [...items] : items.filter((c) => c.categorySlug === category);
}

export type CategoryGroup<T> = { slug: string; title: string; completed: number; total: number; items: T[] };

/**
 * The "All" view: one group per category, in the order the categories come in (their sort order), each holding that
 * category's challenges in the order they arrived (sortHomeChallenges: in progress, required not done, other not
 * started, completed). Categories with nothing to show are left out.
 */
export function groupByCategory<T extends { categorySlug: string }>(
  items: readonly T[],
  categories: readonly { slug: string; title: string; completed: number; total: number }[],
): CategoryGroup<T>[] {
  return categories
    .map((c) => ({ ...c, items: items.filter((i) => i.categorySlug === c.slug) }))
    .filter((g) => g.items.length > 0)
    .map(({ slug, title, completed, total, items: list }) => ({ slug, title, completed, total, items: list }));
}
