import Link from "next/link";
import type { CategoryProgress } from "@/lib/data/learner";

/**
 * The categories as a row of small pills (the height of the header's nav, shaped like our buttons): the title, a compact
 * "done/total" count, and a dot while required challenges are left. Real links to the category pages. The row wraps on
 * desktop and scrolls sideways on a phone; a pill never shrinks or wraps its own text.
 */
export function CategoryPills({ categories }: { categories: CategoryProgress[] }) {
  return (
    <nav aria-label="Categories" data-testid="category-pills" className="min-w-0">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => (
          <li key={c.slug} className="shrink-0">
            <Link
              href={`/categories/${c.slug}`}
              data-testid="category-pill"
              data-slug={c.slug}
              className="bg-card hover:border-primary focus-visible:ring-ring/50 relative inline-flex h-9 items-center gap-2 rounded-full border px-4 text-meta font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px]"
            >
              {c.title}
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
