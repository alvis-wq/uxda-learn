import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, Info } from "lucide-react";
import { SubmissionAnswers } from "@/components/submission-answers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REVIEWABLE_STATUSES } from "@/lib/admin/review";
import { parseChallenge } from "@/lib/challenges/model";
import { getAdminAttemptResults } from "@/lib/data/attempt-results";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Review submission · Admin · UXDA Learn" };

type Criterion = { id: string; score: number; max: number; evidence?: string; comment?: string };

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  ai_reviewed: "AI reviewed",
  published: "Published",
  needs_resubmission: "Needs resubmission",
};

export default async function AdminSubmissionPage({ params }: PageProps<"/admin/submissions/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("*, profiles!submissions_user_id_fkey(full_name,email,track), importer:profiles!submissions_imported_by_fkey(full_name,email)")
    .eq("id", id)
    .maybeSingle();
  if (!sub) notFound();

  const [{ data: row }, { data: evals }] = await Promise.all([
    supabase.from("challenges").select("*").eq("slug", sub.challenge_slug).maybeSingle(),
    supabase.from("evaluations").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
  ]);
  const challenge = row ? parseChallenge(row) : null;
  const evaluation = evals?.[0] ?? null;
  const criteria = (evaluation?.criteria ?? []) as Criterion[];

  const attemptResults = await getAdminAttemptResults(sub, challenge);

  // Admin Storage policy allows signing any submission image; links expire in 1 hour.
  let imageUrls: { path: string; url: string | null }[] = [];
  if (sub.image_paths.length) {
    const { data } = await supabase.storage.from("submissions").createSignedUrls(sub.image_paths, 3600);
    imageUrls = sub.image_paths.map((path) => ({ path, url: data?.find((d) => d.path === path)?.signedUrl ?? null }));
  }

  const reviewable = (REVIEWABLE_STATUSES as readonly string[]).includes(sub.status);
  const initialScore = Number(sub.final_score ?? sub.auto_score);

  return (
    <div className="grid gap-6">
      <Link href="/admin" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden />
        Review queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{challenge?.title ?? sub.challenge_slug}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {sub.profiles?.full_name ?? sub.profiles?.email} · {sub.profiles?.email} · attempt {sub.attempt} ·
            submitted {new Date(sub.submitted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sub.is_test && <Badge variant="outline">Test attempt — doesn&apos;t count</Badge>}
          {sub.is_imported && (
            <Badge variant="outline" data-testid="admin-imported">
              Imported by {sub.importer?.full_name ?? sub.importer?.email ?? "a former admin"}
              {sub.imported_at && ` · ${new Date(sub.imported_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}`}
            </Badge>
          )}
          <Badge variant={reviewable ? "default" : "secondary"} data-testid="admin-status">
            {STATUS_LABEL[sub.status]}
          </Badge>
        </div>
      </div>

      {challenge && challenge.version !== sub.challenge_version && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            Submitted against version {sub.challenge_version}; the challenge is now at version {challenge.version}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
            <CardDescription>
              Auto-graded: {Number(sub.auto_score)} pts · Max {Number(sub.max_score)} pts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubmissionAnswers
              questions={challenge?.questions ?? []}
              answers={(sub.answers ?? {}) as Record<string, unknown>}
              imageUrls={imageUrls}
              figmaUrl={sub.figma_url}
              reflection={sub.reflection}
              results={attemptResults.state === "ready" ? attemptResults.results : undefined}
              reveal={attemptResults.state === "ready" ? attemptResults.reveal : undefined}
            />
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>AI evaluation</CardTitle>
              {evaluation ? (
                <CardDescription className="flex flex-wrap items-center gap-1">
                  {evaluation.confidence === "low" ? (
                    <Badge variant="destructive">
                      <AlertTriangle aria-hidden />
                      Low confidence
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {evaluation.confidence} confidence
                    </Badge>
                  )}
                  {evaluation.flags.map((f) => (
                    <Badge key={f} variant="outline">
                      {f}
                    </Badge>
                  ))}
                  {evaluation.model && <span className="text-xs">· {evaluation.model}</span>}
                </CardDescription>
              ) : (
                <CardDescription>Not evaluated yet — you can review it manually.</CardDescription>
              )}
            </CardHeader>
            {evaluation && (
              <CardContent className="grid gap-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">
                            {challenge?.rubric.find((r) => r.id === c.id)?.criterion ?? c.id}
                          </div>
                          {c.evidence && <div className="text-muted-foreground text-meta mt-1">Evidence: {c.evidence}</div>}
                          {c.comment && <div className="text-muted-foreground text-meta mt-1">{c.comment}</div>}
                        </TableCell>
                        <TableCell className="text-right align-top tabular-nums">
                          {c.score} / {c.max}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-medium">Rubric total</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{Number(evaluation.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewable ? (
                <ReviewForm
                  submissionId={sub.id}
                  maxScore={Number(sub.max_score)}
                  initialScore={initialScore}
                  initialFeedback={sub.feedback ?? evaluation?.feedback ?? ""}
                />
              ) : (
                <div className="grid gap-2 text-sm">
                  <p>
                    Final score: <strong>{sub.final_score ?? "—"}</strong> / {Number(sub.max_score)}
                  </p>
                  {sub.feedback && <p className="text-muted-foreground whitespace-pre-line">{sub.feedback}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
