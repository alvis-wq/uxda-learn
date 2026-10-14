"use client";

import { Check, ChevronDown, ListFilter } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

export type FilterOption = {
  /** The filter value: "all", a category slug, or "drafts". */
  key: string;
  label: string;
  /** Done / total: shown as "1/3". Absent for the drafts option, which shows `count` instead. */
  completed?: number;
  total?: number;
  /** The number of drafts (drafts option only). */
  count?: number;
  /** Required challenges still to do: a dot and "required left" while there are any. */
  requiredOutstanding?: number;
};

/** What the option reads out to a screen reader: the same facts as the visible counts, in words. */
export function optionDescription(o: FilterOption): string {
  const parts: string[] = [];
  if (o.count !== undefined) parts.push(`${o.count} ${o.count === 1 ? "draft" : "drafts"}`);
  else if (o.completed !== undefined && o.total !== undefined) parts.push(`${o.completed} of ${o.total} completed`);
  if (o.requiredOutstanding) parts.push(`${o.requiredOutstanding} required left`);
  return parts.join(", ");
}

/**
 * The home page's filter: a button that opens a menu of single-choice options (All, each category, and for testers
 * Drafts — testing). It is a Radix DropdownMenu with radio items, so the keyboard works as in any menu (Enter, Space or
 * the arrows open it, the arrows and typing move, Enter or Space choose, Escape closes) and focus goes back to the
 * button. The button names the active filter.
 */
export function FilterMenu({
  options,
  selected,
  onSelect,
}: {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const active = options.find((o) => o.key === selected) ?? options[0];

  return (
    // Not modal: the rest of the page isn't hidden from assistive tech or scroll-locked while it is open (a modal menu
    // marks the Filter button itself aria-hidden). Escape, outside clicks and focus loss still close it.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        data-testid="filter-button"
        className={cn(
          "text-meta focus-visible:ring-ring/50 hover:bg-accent inline-flex h-9 max-w-[min(18rem,60vw)] items-center gap-2 rounded-full border px-4 font-medium outline-none transition-colors focus-visible:ring-[3px] motion-reduce:transition-none",
          "data-[state=open]:bg-accent",
        )}
      >
        <ListFilter className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Filter: {active.label}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-label="Filter challenges"
          data-testid="filter-menu"
          className="bg-popover text-popover-foreground z-50 max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-1.5 shadow-lg"
        >
          <DropdownMenu.RadioGroup value={selected} onValueChange={onSelect}>
            {options.map((o) => (
              <DropdownMenu.RadioItem
                key={o.key}
                value={o.key}
                data-testid="filter-option"
                data-slug={o.key}
                className="text-meta data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-pointer items-center gap-2 rounded-lg py-2 pr-3 pl-8 outline-none select-none"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2.5 inline-flex items-center">
                  <Check className="size-4" aria-hidden />
                </DropdownMenu.ItemIndicator>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {!!o.requiredOutstanding && (
                    <span className="text-brand-text mt-0.5 flex items-center gap-1.5 text-xs" data-testid="filter-required-left">
                      <span aria-hidden className="bg-brand-text size-1.5 rounded-full" />
                      required left
                    </span>
                  )}
                </span>
                <span aria-hidden className="text-muted-foreground tabular-nums">
                  {o.count !== undefined ? o.count : `${o.completed}/${o.total}`}
                </span>
                <span className="sr-only">, {optionDescription(o)}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
