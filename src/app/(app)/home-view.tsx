import Link from "next/link";
import { BookOpen, CheckCircle2, Flag } from "lucide-react";
import { PageAurora } from "@/components/aurora/page-aurora";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HomeData } from "@/lib/data/learner";
import { TRACK_LABEL, type Track } from "@/lib/tracks";

/** The signed-in home page: hero, required challenges, categories. Data-free so it can be rendered on its own. */
export function HomeView({
  profile,
  data: { hero, categories, required },
  now,
}: {
  profile: { full_name: string | null; track: Track | null };
  data: HomeData;
  now: Date;
}) {
  const firstName = profile.full_name?.split(" ")[0];
  const withChallenges = categories.filter((c) => c.total > 0);
  const comingSoon = categories.filter((c) => c.total === 0);

  return (
    <main className="w-full">
      <PageAurora />
      <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-28 sm:pt-16">
        <section aria-labelledby="hero-heading" className="mb-14 grid gap-10" data-testid="hero">
          <div className="scrim -mx-3 -my-1 px-3 py-1 w-fit">
            <p className="text-meta text-foreground/80 mb-2">
              {profile.track ? `${TRACK_LABEL[profile.track]} track` : ""}
            </p>
            <h1 id="hero-heading" className="text-3xl font-light tracking-tight sm:text-5xl">
              Welcome{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>

          <div className="grid items-end gap-x-12 gap-y-6 sm:grid-cols-[auto_1fr]">
            <div data-testid="hero-points" className="scrim -mx-3 -my-1 px-3 py-1 w-fit">
              <p className="text-meta text-foreground/80">Total points</p>
              <p className="text-7xl leading-none font-light tracking-tight tabular-nums sm:text-9xl">
                <CountUp value={hero.totalScore} />
              </p>
            </div>
            <dl className="scrim -mx-3 -my-1 px-3 py-1 grid w-fit gap-5 sm:grid-cols-2 sm:pb-3">
              <div data-testid="hero-rank">
                <dt className="text-meta text-foreground/80">Rank{hero.groupLabel ? ` · ${hero.groupLabel}` : ""}</dt>
                <dd className="mt-1 text-2xl font-light">
                  {hero.rank ? (
                    <>
                      #{hero.rank.position}
                      <span className="text-foreground/80 text-base"> of {hero.rank.of}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground/80 text-base">Not ranked · </span>
                      <Link href="/profile" className="text-base underline underline-offset-4">
                        hidden from the leaderboard
                      </Link>
                    </>
                  )}
                </dd>
              </div>
              <div data-testid="hero-completed">
                <dt className="text-meta text-foreground/80">Completed</dt>
                <dd className="mt-1 text-2xl font-light">
                  {hero.completed}
                  <span className="text-foreground/80 text-base"> of {hero.totalScored} challenges</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {required.total > 0 && (
          <section aria-labelledby="required-heading" className="mb-12 grid gap-5" data-testid="required-section">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="required-heading" className="scrim -mx-3 -my-1 px-3 py-1 flex items-center gap-2 text-xl font-light tracking-tight">
                <Flag className="size-5" aria-hidden />
                Required for you
              </h2>
              <p className="scrim -mx-3 -my-1 px-3 py-1 text-muted-foreground" data-testid="required-summary">
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
              <div
                className="bg-tile text-muted-foreground flex items-center gap-3 rounded-[24px] border px-6 py-5"
                data-testid="required-all-done"
              >
                <CheckCircle2 className="text-brand-text size-6 shrink-0" aria-hidden />
                <p>
                  <span className="text-foreground font-medium">All required challenges done</span> — nice work.
                </p>
              </div>
            ) : (
              <ChallengeCardGrid items={required.outstanding} headingLevel={3} now={now} detail="category" />
            )}
          </section>
        )}

      {withChallenges.length === 0 ? (
        <EmptyState
          className="scrim"
          icon={BookOpen}
          title="No challenges yet"
          description="New challenges for your track will show up here."
        />
      ) : (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className={required.total > 0 ? "scrim -mx-3 mb-4 w-fit px-3 text-lg font-semibold" : "sr-only"}>
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
          <h2 id="soon-heading" className="text-foreground text-meta mb-3 font-medium">
            Coming soon
          </h2>
          <ul className="text-muted-foreground text-meta flex flex-wrap gap-2">
            {comingSoon.map((c) => (
              <li key={c.slug} className="bg-card rounded-full border px-3 py-1">
                {c.title}
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </main>
  );
}
