import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionLabel } from "@/components/section-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { inProgressChallenges } from "@/lib/submissions/in-progress";
import { groupAttemptHistory, summarizeScores } from "@/lib/submissions/rules";
import { TRACK_LABEL } from "@/lib/tracks";
import { ChallengeHistoryList } from "./challenge-history";
import { InProgressList } from "./in-progress-list";
import { VisibilityToggle } from "./visibility-toggle";

export const metadata: Metadata = { title: "Profile · UXDA Learn" };

export default async function ProfilePage() {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from("submissions")
    .select("id,challenge_slug,attempt,status,final_score,max_score,feedback,submitted_at,published_at")
    .eq("user_id", profile.id)
    .eq("is_test", false) // test attempts never show up in history or stats
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);

  // Saved, unsubmitted work (RLS: only the learner's own drafts).
  const { data: drafts, error: draftsError } = await supabase
    .from("submission_drafts")
    .select("challenge_slug,updated_at,current_step")
    .eq("user_id", profile.id);
  if (draftsError) throw new Error(`Couldn't load your drafts: ${draftsError.message}`);

  const slugs = [...new Set([...subs.map((s) => s.challenge_slug), ...drafts.map((d) => d.challenge_slug)])];
  const { data: challenges } = slugs.length
    ? await supabase.from("challenges").select("slug,title,status,category_slug,audiences,questions,submission_spec,path_slug").in("slug", slugs)
    : { data: [] };
  // A path milestone reads "Path title · 2. Milestone title" (RLS: paths the learner can see).
  const pathSlugs = [...new Set((challenges ?? []).flatMap((c) => (c.path_slug ? [c.path_slug] : [])))];
  const { data: paths } = pathSlugs.length
    ? await supabase.from("paths").select("slug,title,milestones").in("slug", pathSlugs)
    : { data: [] };
  const titleOf = (slug: string) => {
    const c = challenges?.find((x) => x.slug === slug);
    const p = c?.path_slug ? paths?.find((x) => x.slug === c.path_slug) : undefined;
    if (!c) return slug;
    return p ? `${p.title} · ${p.milestones.indexOf(slug) + 1}. ${c.title}` : c.title;
  };

  const categorySlugs = [...new Set((challenges ?? []).map((c) => c.category_slug))];
  const { data: categories } = categorySlugs.length
    ? await supabase.from("categories").select("slug,title,archived,audiences").in("slug", categorySlugs)
    : { data: [] };
  const inProgress = inProgressChallenges({
    drafts,
    attempts: subs,
    challenges: challenges ?? [],
    categories: categories ?? [],
    track: profile.track,
  });

  const { totalScore, completed, pending } = summarizeScores(subs);
  // A challenge with a draft shows once, in the In progress group (with its best score so far), not again below.
  const inProgressSlugs = new Set(inProgress.map((c) => c.slug));
  const history = groupAttemptHistory(subs).filter((g) => !inProgressSlugs.has(g.slug));
  const now = new Date();

  const stats = [
    { label: "Total score", value: totalScore, testId: "stat-total" },
    { label: "Completed challenges", value: completed, testId: "stat-completed" },
    { label: "Pending reviews", value: pending, testId: "stat-pending" },
  ];

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10">
      <PageHeader
        title={profile.full_name ?? profile.email}
        description={`${profile.email}${profile.track ? ` · ${TRACK_LABEL[profile.track]}` : ""}`}
      />

      <section aria-label="Your stats" className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="gap-2">
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums" data-testid={s.testId}>
                {s.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent>
          <VisibilityToggle initial={profile.show_on_leaderboard} />
        </CardContent>
      </Card>

      <section aria-labelledby="challenges-heading" className="grid gap-3">
        <h2 id="challenges-heading" className="text-lg font-semibold">
          Your challenges
        </h2>
        {inProgress.length > 0 && (
          <div className="grid gap-3" data-testid="in-progress-group">
            <SectionLabel as="h3">In progress</SectionLabel>
            <InProgressList items={inProgress} now={now} />
          </div>
        )}
        {inProgress.length > 0 && history.length > 0 && (
          <SectionLabel as="h3" className="mt-2">Submitted</SectionLabel>
        )}
        {history.length > 0 ? (
          <ChallengeHistoryList groups={history} titleOf={titleOf} />
        ) : inProgress.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No attempts yet"
            description="Challenges you submit appear here with the score that counts, earlier attempts and feedback."
          >
            <Link href="/" className="text-sm font-medium underline underline-offset-4">
              Find a challenge
            </Link>
          </EmptyState>
        ) : null}
      </section>
    </main>
  );
}
