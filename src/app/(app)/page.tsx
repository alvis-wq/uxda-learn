import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getHomeCategories } from "@/lib/data/learner";

const TRACK_LABEL = { strategist: "Strategist", designer: "Designer" } as const;

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const categories = await getHomeCategories(profile);
  const firstName = profile.full_name?.split(" ")[0];
  const withChallenges = categories.filter((c) => c.total > 0);
  const comingSoon = categories.filter((c) => c.total === 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader
        title={`Welcome${firstName ? `, ${firstName}` : ""}`}
        description={`You're on the ${profile.track ? TRACK_LABEL[profile.track] : ""} track.`}
      />

      {withChallenges.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No challenges yet"
          description="New challenges for your track will show up here."
        />
      ) : (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="sr-only">
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
                        <div className="text-muted-foreground flex justify-between text-sm">
                          <span>
                            {c.completed} of {c.total} completed
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
          <h2 id="soon-heading" className="text-muted-foreground mb-3 text-sm font-medium">
            Coming soon
          </h2>
          <ul className="text-muted-foreground flex flex-wrap gap-2 text-sm">
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
