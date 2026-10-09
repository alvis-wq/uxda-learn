import Link from "next/link";
import { BookOpen, CheckCircle2, Flag } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RequiredBadges } from "@/components/required-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { REQUIRED_STATE_LABEL } from "@/lib/challenges/required";
import { getHomeData } from "@/lib/data/learner";
import { TRACK_LABEL } from "@/lib/tracks";

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const now = new Date();
  const { categories, required } = await getHomeData(profile, now);
  const firstName = profile.full_name?.split(" ")[0];
  const withChallenges = categories.filter((c) => c.total > 0);
  const comingSoon = categories.filter((c) => c.total === 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader
        title={`Welcome${firstName ? `, ${firstName}` : ""}`}
        description={`You're on the ${profile.track ? TRACK_LABEL[profile.track] : ""} track.`}
      />

      {required.total > 0 && (
        <section aria-labelledby="required-heading" className="mb-10 grid gap-4" data-testid="required-section">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="required-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Flag className="size-5" aria-hidden />
              Required for you
            </h2>
            <p className="text-muted-foreground" data-testid="required-summary">
              {required.done} of {required.total} required done
              {required.overdue > 0 && (
                <span className="text-destructive font-medium"> · {required.overdue} overdue</span>
              )}
            </p>
          </div>
          <Progress
            value={Math.round((required.done / required.total) * 100)}
            aria-label="Required challenges progress"
          />
          {required.outstanding.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-5" aria-hidden />
              All required challenges are done. Nice work.
            </p>
          ) : (
            <ul className="grid gap-2">
              {required.outstanding.map((ch) => (
                <li key={ch.slug}>
                  <Link
                    href={`/challenges/${ch.slug}`}
                    className="hover:border-primary focus-visible:ring-ring/50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 outline-none transition-colors focus-visible:ring-[3px]"
                  >
                    <span className="min-w-0 font-medium">{ch.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {ch.requiredState === "pending" ? (
                        <span className="text-muted-foreground text-meta">{REQUIRED_STATE_LABEL.pending}</span>
                      ) : (
                        <RequiredBadges required={false} dueAt={ch.due_at} done={false} now={now} />
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {withChallenges.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No challenges yet"
          description="New challenges for your track will show up here."
        />
      ) : (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className={required.total > 0 ? "mb-4 text-lg font-semibold" : "sr-only"}>
            Categories
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {withChallenges.map((c) => {
              const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="focus-visible:ring-ring/50 block h-full rounded-xl outline-none focus-visible:ring-[3px]"
                  >
                    <Card className="hover:border-primary h-full transition-colors">
                      <CardHeader>
                        <CardTitle>{c.title}</CardTitle>
                        {c.description && <CardDescription>{c.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="mt-auto grid gap-2">
                        <div className="text-muted-foreground text-meta flex flex-wrap justify-between gap-x-4">
                          <span>
                            {c.completed} of {c.total} completed
                            {c.requiredOutstanding > 0 && ` · ${c.requiredOutstanding} required to do`}
                          </span>
                          <span>
                            {c.pointsEarned} / {c.pointsPossible} pts
                          </span>
                        </div>
                        <Progress value={pct} aria-label={`${c.title} progress`} />
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {comingSoon.length > 0 && (
        <section className="mt-10" aria-labelledby="soon-heading">
          <h2 id="soon-heading" className="text-muted-foreground text-meta mb-3 font-medium">
            Coming soon
          </h2>
          <ul className="text-muted-foreground text-meta flex flex-wrap gap-2">
            {comingSoon.map((c) => (
              <li key={c.slug} className="rounded-full border px-3 py-1">
                {c.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
