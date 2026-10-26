import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { loadTeamInput } from "@/lib/data/team-progress";
import { buildTeamMatrix } from "@/lib/team/progress";
import { isTrack, SELECTABLE_TRACKS, type Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { TeamMatrixView } from "./team-matrix";

export const metadata: Metadata = { title: "Team progress · UXDA Learn" };

function hrefWith(params: { track?: Track; category?: string }) {
  const q = new URLSearchParams();
  if (params.track) q.set("track", params.track);
  if (params.category) q.set("category", params.category);
  const s = q.toString();
  return s ? `/team?${s}` : "/team";
}

function FilterPills({ label, items }: { label: string; items: { key: string; label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="bg-muted inline-flex w-fit max-w-full flex-wrap rounded-3xl p-1 sm:rounded-full">
      {items.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          aria-current={f.active ? "page" : undefined}
          className={cn(
            "focus-visible:ring-ring/50 rounded-full px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
            f.active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Team progress, for leads and admins: everyone onboarded as rows, every published challenge and path as columns
 * under their category. Status, best score and completion date only; nobody's answers or feedback.
 */
export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const params = await searchParams;
  const track = isTrack(params.track) ? params.track : undefined;
  const category = typeof params.category === "string" && params.category ? params.category : undefined;
  const now = new Date();
  const matrix = buildTeamMatrix(await loadTeamInput(), { track, category });

  const trackFilters = [
    { key: "all", label: "All tracks", href: hrefWith({ category }), active: !track },
    ...SELECTABLE_TRACKS.map((t) => ({
      key: t.value,
      label: t.label,
      href: hrefWith({ track: t.value, category }),
      active: track === t.value,
    })),
  ];
  const categoryFilters = [
    { key: "all", label: "All categories", href: hrefWith({ track }), active: !category },
    ...matrix.categories.map((c) => ({
      key: c.slug,
      label: c.title,
      href: hrefWith({ track, category: c.slug }),
      active: category === c.slug,
    })),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <PageHeader
        title="Team progress"
        description="Who has finished which challenge, by category. Scores are the best published attempt; a path is one column, done when every milestone has a score."
      />

      <div className="mb-6 grid gap-3">
        <FilterPills label="Filter by track" items={trackFilters} />
        {matrix.categories.length > 1 && <FilterPills label="Filter by category" items={categoryFilters} />}
      </div>

      {matrix.rows.length === 0 ? (
        <EmptyState icon={Users} title={track ? "No one on this track yet" : "No one has joined yet"} />
      ) : matrix.groups.length === 0 ? (
        category ? (
          <EmptyState icon={LayoutGrid} title="Nothing in this category for these people">
            <Link href={hrefWith({ track })} className="text-sm font-medium underline-offset-4 hover:underline">
              Show all categories
            </Link>
          </EmptyState>
        ) : (
          <EmptyState icon={LayoutGrid} title="No published challenges yet" description="Published challenges and paths show up here." />
        )
      ) : (
        <TeamMatrixView matrix={matrix} track={track} now={now} />
      )}
    </main>
  );
}
