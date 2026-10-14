"use client";

import { useSearchParams } from "next/navigation";
import { BookOpen, FlaskConical } from "lucide-react";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { EmptyState } from "@/components/empty-state";
import { FilterMenu, type FilterOption } from "@/components/filter-menu";
import { SectionLabel } from "@/components/section-label";
import { ALL_CATEGORIES, DRAFTS_FILTER, filterByCategory, groupByCategory, parseHomeFilter } from "@/lib/challenges/home-order";
import type { CardChallenge, CategoryProgress } from "@/lib/data/learner";

const PARAM = "category";

/**
 * The home page's "Challenges": under All, one group per category (a small bold label with the category's name and
 * done/total, its cards below); the Filter menu on the right of the heading narrows it to one group, without its label,
 * or, for testers, to the drafts. The filter lives in the URL (`?category=slug`, absent = All, `drafts` for testers) so a
 * reload, back/forward and a shared link show the same list; choosing an option updates it with `history.pushState`,
 * which Next syncs into `useSearchParams` without a navigation or a fetch, so the list changes on the client at once.
 * Order is fixed by the server (sortHomeChallenges) and grouping and filtering keep it. Drafts are never in All or in
 * a category: they only exist under the tester's "Drafts — testing" option.
 */
export function HomeChallenges({
  categories,
  overall,
  requiredLeft,
  challenges,
  drafts,
  tester,
  now,
}: {
  categories: CategoryProgress[];
  overall: { done: number; total: number };
  /** Required challenges not done, across everything (the "All" option's "required left"). */
  requiredLeft: number;
  /** Never drafts. */
  challenges: CardChallenge[];
  drafts: CardChallenge[];
  /** Testers get the "Drafts — testing" option (even with no drafts). */
  tester: boolean;
  now: Date;
}) {
  const searchParams = useSearchParams();
  const selected = parseHomeFilter(
    searchParams.get(PARAM),
    categories.map((c) => c.slug),
    { tester },
  );

  const options: FilterOption[] = [
    { key: ALL_CATEGORIES, label: "All", completed: overall.done, total: overall.total, requiredOutstanding: requiredLeft },
    ...categories.map((c) => ({ key: c.slug, label: c.title, completed: c.completed, total: c.total, requiredOutstanding: c.requiredOutstanding })),
    ...(tester ? [{ key: DRAFTS_FILTER, label: "Drafts — testing", count: drafts.length }] : []),
  ];

  const select = (key: string) => {
    if (key === selected) return;
    const params = new URLSearchParams(searchParams.toString());
    if (key === ALL_CATEGORIES) params.delete(PARAM);
    else params.set(PARAM, key);
    const query = params.toString();
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const label = options.find((o) => o.key === selected)?.label ?? "All";
  const shown = selected === DRAFTS_FILTER ? drafts : filterByCategory(challenges, selected);
  const groups = groupByCategory(challenges, categories);

  return (
    <section aria-labelledby="challenges-heading" className="mt-12 grid gap-5" data-testid="challenges-section">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionLabel id="challenges-heading">Challenges</SectionLabel>
        <FilterMenu options={options} selected={selected} onSelect={select} />
      </div>
      {/* Said once per change, since nothing else on the page moves when a filter is chosen. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="filter-status">
        {selected === ALL_CATEGORIES ? "Showing all" : `Showing ${label}:`} {shown.length} {shown.length === 1 ? "challenge" : "challenges"}
      </p>

      {/* Re-keyed per filter so the list fades in; no animation with reduced motion. */}
      <div key={selected} className="animate-in fade-in grid gap-10 duration-200 motion-reduce:animate-none" data-testid="challenge-list">
        {selected === ALL_CATEGORIES ? (
          groups.length === 0 ? (
            <EmptyState icon={BookOpen} title="Nothing here yet." description="New challenges for your track will show up here." />
          ) : (
            groups.map((g) => (
              <section key={g.slug} aria-labelledby={`group-${g.slug}`} className="grid gap-4" data-testid="category-group" data-slug={g.slug}>
                <h3 id={`group-${g.slug}`} className="text-meta flex items-baseline gap-2 font-bold">
                  {g.title}
                  <span aria-hidden className="text-foreground/80 font-normal tabular-nums" data-testid="group-count">
                    {g.completed}/{g.total}
                  </span>
                  <span className="sr-only">
                    {" "}
                    — {g.completed} of {g.total} completed
                  </span>
                </h3>
                <ChallengeCardGrid items={g.items} headingLevel={4} now={now} detail="category" />
              </section>
            ))
          )
        ) : shown.length === 0 ? (
          selected === DRAFTS_FILTER ? (
            <EmptyState icon={FlaskConical} title="No drafts to test" description="Draft challenges your track can see will show up here." />
          ) : (
            <EmptyState icon={BookOpen} title="Nothing here yet." description="New challenges for your track will show up here." />
          )
        ) : (
          <ChallengeCardGrid items={shown} headingLevel={3} now={now} detail="category" />
        )}
      </div>
    </section>
  );
}
