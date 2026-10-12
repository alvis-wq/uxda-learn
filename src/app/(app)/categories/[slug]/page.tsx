import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ListChecks } from "lucide-react";
import { ChallengeCardGrid } from "@/components/challenge-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
        <ChallengeCardGrid items={challenges} headingLevel={2} now={now} detail="summary" />
      )}
    </main>
  );
}
