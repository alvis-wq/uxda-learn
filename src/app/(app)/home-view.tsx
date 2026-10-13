import Link from "next/link";
import { BookOpen, CheckCircle2, Flag } from "lucide-react";
import { GLOW_CLEARANCE_CSS } from "@/components/aurora/geometry";
import { PageAurora } from "@/components/aurora/page-aurora";
import { CategoryPills } from "@/components/category-pills";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
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
  // A category with no challenge visible to the learner gets no pill.
  const withChallenges = categories.filter((c) => c.total > 0);

  return (
    <main className="w-full">
      <PageAurora />
      {/* Bottom padding = how high the glow reaches (see aurora/geometry.ts): scrolled to the end, all text is above it. */}
      <div
        className="mx-auto w-full max-w-5xl px-4 pt-10 sm:pt-16"
        style={{ paddingBottom: GLOW_CLEARANCE_CSS }}
      >
        <section aria-labelledby="hero-heading" className="mb-14 grid gap-10" data-testid="hero">
          <div>
            <p className="text-meta text-foreground/80 mb-2">
              {profile.track ? `${TRACK_LABEL[profile.track]} track` : ""}
            </p>
            <h1 id="hero-heading" className="text-3xl font-light tracking-tight sm:text-5xl">
              Welcome{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>

          <div className="grid items-end gap-x-12 gap-y-6 sm:grid-cols-[auto_1fr]">
            <div data-testid="hero-points">
              <p className="text-meta text-foreground/80">Total points</p>
              <p className="text-7xl leading-none font-light tracking-tight tabular-nums sm:text-9xl">
                <CountUp value={hero.totalScore} />
              </p>
            </div>
            <dl className="grid gap-5 sm:grid-cols-2 sm:pb-3">
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

        {withChallenges.length > 0 ? (
          <section aria-labelledby="categories-heading">
            <h2 id="categories-heading" className="sr-only">
              Categories
            </h2>
            <CategoryPills categories={withChallenges} />
          </section>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No challenges yet"
            description="New challenges for your track will show up here."
          />
        )}

        {required.total > 0 && (
          <section aria-labelledby="required-heading" className="mt-12 grid gap-5" data-testid="required-section">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="required-heading" className="flex items-center gap-2 text-xl font-light tracking-tight">
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
      </div>
    </main>
  );
}
