import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { SubmissionAnswers } from "@/components/submission-answers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { parseChallenge } from "@/lib/challenges/model";
import { getLearnerAttemptResults } from "@/lib/data/attempt-results";
import { createClient } from "@/lib/supabase/server";
import { isResultVisible } from "@/lib/submissions/rules";

export const metadata: Metadata = { title: "Submission · UXDA Learn" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function SubmissionPage({ params }: PageProps<"/submissions/[id]">) {
  const { id } = await params;
  const profile = await requireOnboardedProfile();
  if (!UUID_RE.test(id)) notFound();

  // RLS: users can only read their own submissions. Learners only see their own here
  // even if they're admins (admins review in /admin).
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!sub) notFound();

  const { data: row } = await supabase.from("challenges").select("*").eq("slug", sub.challenge_slug).maybeSingle();
  const challenge = row ? parseChallenge(row) : null;

  // Per-question marks. The right answers come back only when this learner is entitled to them (full marks or all
  // attempts used), so nothing else can leak into the page.
  const attemptResults = await getLearnerAttemptResults(profile.id, sub, challenge);

  // Signed URLs via the user's own client — Storage RLS limits them to their own folder.
  let imageUrls: { path: string; url: string | null }[] = [];
  if (sub.image_paths.length) {
    const { data } = await supabase.storage.from("submissions").createSignedUrls(sub.image_paths, 60 * 10);
    imageUrls = sub.image_paths.map((path) => ({ path, url: data?.find((d) => d.path === path)?.signedUrl ?? null }));
  }

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Link
        href={`/challenges/${sub.challenge_slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {challenge?.title ?? sub.challenge_slug}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Attempt {sub.attempt}</h1>
        <StatusBadge status={sub.status} />
      </div>
      <p className="text-muted-foreground -mt-4 text-sm">
        Submitted {new Date(sub.submitted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
      </p>

      {isResultVisible(sub.status) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {sub.status === "published" ? "Result" : "Changes requested"}
              {sub.final_score !== null && (
                <span className="ml-2 font-normal" data-testid="attempt-result-score">
                  {sub.final_score} / {sub.max_score} pts
                </span>
              )}
            </CardTitle>
          </CardHeader>
          {sub.feedback && <CardContent className="text-sm whitespace-pre-line">{sub.feedback}</CardContent>}
        </Card>
      )}

      {attemptResults.state === "outdated" && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            This challenge was updated after your attempt, so the question-by-question marks aren&apos;t available for it.
          </AlertDescription>
        </Alert>
      )}

      <SubmissionAnswers
        questions={challenge?.questions ?? []}
        answers={(sub.answers ?? {}) as Record<string, unknown>}
        imageUrls={imageUrls}
        figmaUrl={sub.figma_url}
        reflection={sub.reflection}
        results={attemptResults.state === "ready" ? attemptResults.results : undefined}
        reveal={attemptResults.state === "ready" ? attemptResults.reveal : undefined}
      />

      {attemptResults.state === "ready" && !attemptResults.reveal.reveal && isResultVisible(sub.status) && (
        <div>
          <Link href={`/challenges/${sub.challenge_slug}`} className={buttonVariants()} data-testid="try-again-link">
            Try again
          </Link>
        </div>
      )}
    </main>
  );
}
