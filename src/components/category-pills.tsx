"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type CategoryPill = {
  /** The filter value: a category slug, or "all". */
  key: string;
  label: string;
  completed: number;
  total: number;
  /** Required challenges still to do here: a dot while there are any. */
  requiredOutstanding: number;
};

/**
 * The category filter as a row of small pills (the height of the header's nav, shaped like our buttons): the title, a compact
 * "done/total" count, and a dot while required challenges are left. They are real links (`href` keeps the filter in the
 * URL, so they can be copied or opened in a new tab); a plain click is intercepted by `onSelect`, which filters in place.
 * The selected pill is filled like the header's active nav item (the nav's thumb on its track). The row wraps on
 * desktop and scrolls sideways on a phone; a pill never shrinks or wraps its own text.
 */
export function CategoryPills({
  pills,
  selected,
  onSelect,
  hrefFor,
}: {
  pills: CategoryPill[];
  selected: string;
  onSelect: (key: string) => void;
  hrefFor: (key: string) => string;
}) {
  // On a phone the row scrolls: keep the selected pill in view (also after back/forward or a shared link). Only the row
  // moves, never the page.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const row = list.current;
    const pill = row?.querySelector<HTMLElement>("[data-active]");
    if (!row || !pill || row.scrollWidth <= row.clientWidth) return;
    const edge = 16;
    const [left, right] = [pill.offsetLeft - edge, pill.offsetLeft + pill.offsetWidth + edge];
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
  }, [selected]);

  function onClick(event: MouseEvent<HTMLAnchorElement>, key: string) {
    // Leave modified and non-primary clicks to the browser (new tab, new window, download).
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(key);
  }

  return (
    <nav aria-label="Categories" data-testid="category-pills" className="min-w-0">
      <ul ref={list} className="relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {pills.map((c) => {
          const active = c.key === selected;
          return (
            <li key={c.key} className="shrink-0">
              <a
                href={hrefFor(c.key)}
                onClick={(event) => onClick(event, c.key)}
                aria-current={active ? "true" : undefined}
                data-testid="category-pill"
                data-slug={c.key}
                data-active={active ? "" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 text-meta relative inline-flex h-9 items-center gap-2 rounded-full border px-4 font-medium whitespace-nowrap outline-none transition-colors motion-reduce:transition-none focus-visible:ring-[3px]",
                  active
                    ? "border-transparent bg-[var(--nav-thumb)] text-[var(--nav-text-active)] shadow-sm"
                    : "hover:border-primary border-transparent bg-[var(--nav-track)] text-[var(--nav-text)]",
                )}
              >
                {c.label}
                <span aria-hidden className="text-muted-foreground tabular-nums">
                  {c.completed}/{c.total}
                </span>
                {c.requiredOutstanding > 0 && (
                  <span aria-hidden data-testid="category-required-dot" className="bg-brand-text size-2 rounded-full" />
                )}
                <span className="sr-only">
                  {" "}
                  — {c.completed} of {c.total} completed
                  {c.requiredOutstanding > 0 && `, ${c.requiredOutstanding} required to do`}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
