import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isResultVisible, summarizeScores } from "@/lib/submissions/rules";
import { TRACK_LABEL } from "@/lib/tracks";
import { VisibilityToggle } from "./visibility-toggle";

export const metadata: Metadata = { title: "Profile · UXDA Learn" };

export default async function ProfilePage() {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from("submissions")
    .select("id,challenge_slug,attempt,status,final_score,max_score,feedback,submitted_at,published_at")
    .eq("user_id", profile.id)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);

  const slugs = [...new Set(subs.map((s) => s.challenge_slug))];
  const { data: challenges } = slugs.length
    ? await supabase.from("challenges").select("slug,title").in("slug", slugs)
    : { data: [] };
  const titleOf = (slug: string) => challenges?.find((c) => c.slug === slug)?.title ?? slug;

  const { totalScore, completed, pending } = summarizeScores(subs);
  const history = subs.filter((s) => isResultVisible(s.status));

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

      <section aria-labelledby="feedback-heading" className="grid gap-3">
        <h2 id="feedback-heading" className="text-lg font-semibold">
          Feedback history
        </h2>
        {history.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No results yet"
            description="Scores and feedback appear here once your submissions are graded or reviewed."
          />
        ) : (
          <ul className="grid gap-3">
            {history.map((s) => (
              <li key={s.id}>
                <Card className="gap-3 py-4">
                  <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
                    <CardTitle className="text-sm">
                      <Link href={`/submissions/${s.id}`} className="hover:underline">
                        {titleOf(s.challenge_slug)}
                      </Link>
                      <span className="text-muted-foreground text-meta ml-2 font-normal">Attempt {s.attempt}</span>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      {s.final_score !== null && (
                        <span className="text-meta font-medium">
                          {s.final_score} / {s.max_score}
                        </span>
                      )}
                      <StatusBadge status={s.status} />
                    </div>
                  </CardHeader>
                  {s.feedback && (
                    <CardContent className="text-muted-foreground px-4 text-sm whitespace-pre-line">
                      {s.feedback}
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
