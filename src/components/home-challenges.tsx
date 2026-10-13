"use client";

import { useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { CategoryPills, type CategoryPill } from "@/components/category-pills";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { EmptyState } from "@/components/empty-state";
import { SectionLabel } from "@/components/section-label";
import { ALL_CATEGORIES, filterByCategory, parseCategoryFilter } from "@/lib/challenges/home-order";
import type { CardChallenge, CategoryProgress } from "@/lib/data/learner";

const PARAM = "category";

/**
 * "Categories" and "Challenges" on the home page: the pills are a filter for the list under them. The filter lives in the
 * URL (`?category=slug`, absent = All) so a reload, back/forward and a shared link all show the same list; choosing a
 * pill updates it with `history.pushState`, which Next syncs into `useSearchParams` without a navigation or a fetch,
 * so the list filters on the client at once. The list's order is fixed by the server (sortHomeChallenges) and filtering keeps it.
 */
export function HomeChallenges({
  categories,
  overall,
  requiredLeft,
  challenges,
  now,
}: {
  categories: CategoryProgress[];
  overall: { done: number; total: number };
  /** Required challenges not done, across everything (the "All" pill's dot). */
  requiredLeft: number;
  challenges: CardChallenge[];
  now: Date;
}) {
  const searchParams = useSearchParams();
  const selected = parseCategoryFilter(
    searchParams.get(PARAM),
    categories.map((c) => c.slug),
  );

  const pills: CategoryPill[] = [
    { key: ALL_CATEGORIES, label: "All", completed: overall.done, total: overall.total, requiredOutstanding: requiredLeft },
    ...categories.map((c) => ({ key: c.slug, label: c.title, completed: c.completed, total: c.total, requiredOutstanding: c.requiredOutstanding })),
  ];

  /** The current URL's query with the filter set (or removed for All): other params are kept. */
  const queryFor = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === ALL_CATEGORIES) params.delete(PARAM);
    else params.set(PARAM, key);
    return params.toString();
  };
  const hrefFor = (key: string) => {
    const query = queryFor(key);
    return query ? `?${query}` : "?";
  };

  const shown = filterByCategory(challenges, selected);
  const selectedLabel = pills.find((p) => p.key === selected)?.label ?? "All";

  return (
    <>
      <section aria-labelledby="categories-heading" className="grid gap-3">
        <SectionLabel id="categories-heading">Categories</SectionLabel>
        <CategoryPills
          pills={pills}
          selected={selected}
          hrefFor={hrefFor}
          onSelect={(key) => {
            if (key === selected) return;
            const query = queryFor(key);
            window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
          }}
        />
      </section>

      <section aria-labelledby="challenges-heading" className="mt-12 grid gap-4" data-testid="challenges-section">
        <SectionLabel id="challenges-heading">Challenges</SectionLabel>
        {/* Said once per change, since nothing else on the page moves when a pill is chosen. */}
        <p role="status" aria-live="polite" className="sr-only" data-testid="filter-status">
          {selected === ALL_CATEGORIES ? "Showing all" : `Showing ${selectedLabel}:`} {shown.length} {shown.length === 1 ? "challenge" : "challenges"}
        </p>
        {shown.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nothing here yet." description="New challenges for your track will show up here." />
        ) : (
          // Re-keyed per filter so the list fades in; no animation with reduced motion.
          <div key={selected} className="animate-in fade-in duration-200 motion-reduce:animate-none" data-testid="challenge-list">
            <ChallengeCardGrid items={shown} headingLevel={3} now={now} detail="category" />
          </div>
        )}
      </section>
    </>
  );
}
