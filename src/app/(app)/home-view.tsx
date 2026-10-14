import Link from "next/link";
import { BookOpen } from "lucide-react";
import { GLOW_CLEARANCE_CSS } from "@/components/aurora/geometry";
import { PageAurora } from "@/components/aurora/page-aurora";
import { CountUp } from "@/components/count-up";
import { EmptyState } from "@/components/empty-state";
import { HomeChallenges } from "@/components/home-challenges";
import { SectionLabel, SECTION_LABEL_CLASS } from "@/components/section-label";
import { Progress } from "@/components/ui/progress";
import type { HomeData } from "@/lib/data/learner";
import { TRACK_LABEL, type Track } from "@/lib/tracks";

/** The signed-in home page: hero, overall progress, then the category filter and the challenge list. Data-free so it can be rendered on its own. */
export function HomeView({
  profile,
  data: { hero, overall, categories, required, challenges, drafts },
  now,
}: {
  profile: { full_name: string | null; track: Track | null; is_tester: boolean };
  data: HomeData;
  now: Date;
}) {
  const firstName = profile.full_name?.split(" ")[0];
  // A category with no challenge visible to the learner gets no group and no filter option.
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
                    hero.hidden ? (
                      <>
                        <span className="text-foreground/80 text-base">Not ranked · </span>
                        <Link href="/profile" className="text-base underline underline-offset-4">
                          hidden from the leaderboard
                        </Link>
                      </>
                    ) : (
                      <span className="text-foreground/80 text-base">Not ranked yet</span>
                    )
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

            <HomeChallenges
              categories={withChallenges}
              overall={overall}
              requiredLeft={required.total - required.done}
              challenges={challenges}
              drafts={drafts}
              tester={profile.is_tester}
              now={now}
            />
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No challenges yet"
            description="New challenges for your track will show up here."
          />
        )}

      </div>
    </main>
  );
}
