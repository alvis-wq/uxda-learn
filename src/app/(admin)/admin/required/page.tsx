import type { Metadata } from "next";
import Link from "next/link";
import { Download, Flag, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RequiredStateBadge } from "@/components/required-state-badge";
import { Button } from "@/components/ui/button";
import { buildRequiredProgress } from "@/lib/admin/required-progress";
import { REQUIRED_STATE_LABEL, type RequiredState } from "@/lib/challenges/required";
import { loadProgressInput } from "@/lib/data/admin-progress";
import { isTrack, TRACK_LABEL, TRACKS } from "@/lib/tracks";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Required progress · Admin · UXDA Learn" };

const STATES: RequiredState[] = ["overdue", "missing", "pending", "done"];

export default async function AdminRequiredPage({ searchParams }: PageProps<"/admin/required">) {
  const requested = (await searchParams).track;
  const track = isTrack(requested) ? requested : undefined;
  const now = new Date();
  const input = await loadProgressInput(now);
  const rows = buildRequiredProgress(input, track);
  const anyRequired = input.challenges.some((c) => c.required_for.length > 0);
  const totals = Object.fromEntries(
    STATES.map((s) => [s, rows.reduce((n, r) => n + r.counts[s], 0)]),
  ) as Record<RequiredState, number>;
  const csvHref = `/admin/export/required.csv${track ? `?track=${track}` : ""}`;

  const filters = [{ value: undefined, label: "All tracks" }, ...TRACKS.map((t) => ({ value: t.value, label: t.label }))];

  return (
    <section aria-labelledby="required-heading" className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="required-heading" className="text-2xl font-semibold tracking-tight">
            Required progress
          </h1>
          <p className="text-muted-foreground mt-1">
            Per person: required challenges that are done, awaiting review, not done or overdue.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          {/* Plain <a>: the route handler returns a file download. */}
          <a href={csvHref} download>
            <Download aria-hidden />
            Export CSV
          </a>
        </Button>
      </div>

      <nav aria-label="Filter by track" className="bg-muted inline-flex w-fit max-w-full flex-wrap rounded-3xl p-1 sm:rounded-full">
        {filters.map((f) => {
          const active = f.value === track;
          return (
            <Link
              key={f.label}
              href={f.value ? `/admin/required?track=${f.value}` : "/admin/required"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {!anyRequired ? (
        <EmptyState
          icon={Flag}
          title="No required challenges yet"
          description="Add required_for to a challenge's frontmatter and run content:sync."
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No one on this track yet" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Totals">
            {STATES.map((s) => (
              <div key={s} className="bg-card rounded-lg border px-4 py-3">
                <dt className="text-muted-foreground text-meta">{REQUIRED_STATE_LABEL[s]}</dt>
                <dd className="text-2xl font-semibold tabular-nums" data-testid={`total-${s}`}>
                  {totals[s]}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="grid gap-2">
            {rows.map(({ user, items, counts }) => (
              <li key={user.id} data-testid={`required-row-${user.email}`}>
                <details className="group bg-card rounded-lg border">
                  <summary className="focus-visible:ring-ring/50 flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg px-4 py-3 outline-none focus-visible:ring-[3px]">
                    <span className="min-w-0">
                      <span className="block font-medium">{user.full_name ?? user.email}</span>
                      <span className="text-muted-foreground text-meta block">
                        {TRACK_LABEL[user.track]} · {user.email}
                      </span>
                    </span>
                    <span className="text-meta flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                      {items.length === 0 ? (
                        <span className="text-muted-foreground">Nothing required</span>
                      ) : (
                        <>
                          <span>
                            {counts.done}/{items.length} done
                          </span>
                          {counts.pending > 0 && <span className="text-muted-foreground">{counts.pending} awaiting review</span>}
                          {counts.missing > 0 && <span className="text-muted-foreground">{counts.missing} not done</span>}
                          {counts.overdue > 0 && (
                            <span className="text-destructive font-medium">{counts.overdue} overdue</span>
                          )}
                        </>
                      )}
                    </span>
                  </summary>
                  {items.length > 0 && (
                    <ul className="grid gap-2 border-t px-4 py-3">
                      {items.map((i) => (
                        <li key={i.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                          <Link href={`/challenges/${i.slug}`} className="min-w-0 hover:underline">
                            {i.title}
                          </Link>
                          <span className="text-muted-foreground text-meta flex flex-wrap items-center gap-2">
                            {i.completedAt
                              ? `Completed ${formatDate(i.completedAt, now)}`
                              : i.due_at && `Due ${formatDate(i.due_at, now)}`}
                            <RequiredStateBadge state={i.state} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
