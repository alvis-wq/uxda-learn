import Link from "next/link";
import { BookOpen } from "lucide-react";
import { GLOW_CLEARANCE_CSS } from "@/components/aurora/geometry";
import { PageAurora } from "@/components/aurora/page-aurora";
import { CategoryPills } from "@/components/category-pills";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { SectionLabel, SECTION_LABEL_CLASS } from "@/components/section-label";
import { Progress } from "@/components/ui/progress";
import { optionalHint } from "@/lib/challenges/optional-hint";
import type { HomeData } from "@/lib/data/learner";
import { TRACK_LABEL, type Track } from "@/lib/tracks";

/** The signed-in home page: hero, overall progress, categories, required challenges. Data-free so it can be rendered on its own. */
export function HomeView({
  profile,
  data: { hero, overall, categories, required },
  now,
}: {
  profile: { full_name: string | null; track: Track | null };
  data: HomeData;
  now: Date;
}) {
  const firstName = profile.full_name?.split(" ")[0];
  // A category with no challenge visible to the learner gets no pill.
  const withChallenges = categories.filter((c) => c.total > 0);
  const hint = optionalHint(required.outstanding.length, required.optionalRemaining);

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
            <p className={`${SECTION_LABEL_CLASS} mb-2`}>
              {profile.track ? `${TRACK_LABEL[profile.track]} track` : ""}
            </p>
            <h1 id="hero-heading" className="text-3xl font-light tracking-tight sm:text-5xl">
              Welcome{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>

          <div className="grid items-end gap-x-12 gap-y-6 sm:grid-cols-[auto_1fr]">
            <div data-testid="hero-points">
              <p className={SECTION_LABEL_CLASS}>Total points</p>
              <p className="text-7xl leading-none font-light tracking-tight tabular-nums sm:text-9xl">
                <CountUp value={hero.totalScore} />
              </p>
            </div>
            <dl className="sm:pb-3">
              <div data-testid="hero-rank">
                <dt className={SECTION_LABEL_CLASS}>Rank{hero.groupLabel ? ` · ${hero.groupLabel}` : ""}</dt>
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
            </dl>
          </div>
        </section>

        {withChallenges.length > 0 ? (
          <>
            <section aria-labelledby="overall-heading" className="mb-10 grid max-w-xl gap-3" data-testid="overall-progress">
              <SectionLabel id="overall-heading">Overall progress</SectionLabel>
              <p className="text-2xl font-light">
                <span data-testid="overall-count">
                  {overall.done} of {overall.total}
                </span>
                <span className="text-foreground/80 text-base"> challenges completed</span>
              </p>
              <Progress
                value={overall.total ? Math.round((overall.done / overall.total) * 100) : 0}
                aria-labelledby="overall-heading"
              />
              {required.total > 0 && (
                <p className="text-muted-foreground" data-testid="required-summary">
                  Required: {required.done} of {required.total} done
                  {required.overdue > 0 && (
                    <span className="text-destructive font-medium"> · {required.overdue} overdue</span>
                  )}
                </p>
              )}
            </section>

            <section aria-labelledby="categories-heading" className="grid gap-3">
              <SectionLabel id="categories-heading">Categories</SectionLabel>
              <CategoryPills categories={withChallenges} />
            </section>
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No challenges yet"
            description="New challenges for your track will show up here."
          />
        )}

        {required.total > 0 && (
          <section aria-labelledby="required-heading" className="mt-12 grid gap-4" data-testid="required-section">
            <SectionLabel id="required-heading">Required for you</SectionLabel>
            {required.outstanding.length > 0 && (
              <ChallengeCardGrid items={required.outstanding} headingLevel={3} now={now} detail="category" />
            )}
            {hint && (
              <p className="text-muted-foreground" data-testid="optional-hint">
                {hint}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
