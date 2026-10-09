import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ListChecks } from "lucide-react";
import { ChallengeMeta } from "@/components/challenge-meta";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RequiredBadges } from "@/components/required-badge";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getCategoryPage } from "@/lib/data/learner";

export const metadata: Metadata = { title: "Category · UXDA Learn" };

export default async function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const profile = await requireOnboardedProfile();
  const data = await getCategoryPage(profile, slug);
  if (!data) notFound();
  const { category, challenges } = data;
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href="/" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden />
        All categories
      </Link>
      <PageHeader title={category.title} description={category.description} />

      {challenges.length === 0 ? (
        <EmptyState icon={ListChecks} title="No challenges here yet" description="Check back soon." />
      ) : (
        <ul className="grid gap-3">
          {challenges.map((ch) => (
            <li key={ch.slug}>
              <Link
                href={`/challenges/${ch.slug}`}
                className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-[3px]"
              >
                <Card className="hover:border-primary gap-3 transition-colors">
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="grid gap-1.5">
                      <CardTitle>{ch.title}</CardTitle>
                      {ch.summary && <CardDescription>{ch.summary}</CardDescription>}
                      <RequiredBadges required={ch.required} dueAt={ch.due_at} done={ch.done} now={now} />
                    </div>
                    <StatusBadge
                      status={ch.state.latest?.status}
                      acknowledged={ch.type === "acknowledge" ? ch.done : undefined}
                    />
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <ChallengeMeta challenge={ch} />
                    {ch.type !== "acknowledge" && ch.state.bestScore !== null && (
                      <span className="text-meta font-medium">
                        Best: {ch.state.bestScore} / {ch.points}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
