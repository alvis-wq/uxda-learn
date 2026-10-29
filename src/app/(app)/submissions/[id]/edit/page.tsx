import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { briefView } from "@/lib/challenges/brief";
import { challengeNeedsReview, parseChallenge } from "@/lib/challenges/model";
import { questionsForAttempt } from "@/lib/data/attempt-order";
import { prepareFormDraft } from "@/lib/data/drafts";
import { createClient } from "@/lib/supabase/server";
import { isEditable } from "@/lib/submissions/rules";
import { planSteps } from "@/lib/submissions/steps";
import { ChallengeForm } from "../../../challenges/[slug]/challenge-form";
import { SteppedChallengeForm } from "../../../challenges/[slug]/stepped-challenge-form";

export const metadata: Metadata = { title: "Edit submission · UXDA Learn" };

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Change a submission that's still waiting for review. The form opens with what was submitted (made to fit the
 * challenge as it is now, like a draft), on the attempt's own question order; nothing is saved until Save, which goes
 * through editSubmission. Once reviewed, this page sends the learner back to the submission.
 */
export default async function EditSubmissionPage({ params }: PageProps<"/submissions/[id]/edit">) {
  const { id } = await params;
  const profile = await requireOnboardedProfile();
  if (!UUID_RE.test(id)) notFound();

  // RLS: own submissions only.
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!sub) notFound();
  if (!isEditable(sub)) redirect(`/submissions/${id}`);

  // RLS: only a challenge the learner can still see.
  const { data: row } = await supabase.from("challenges").select("*").eq("slug", sub.challenge_slug).maybeSingle();
  if (!row || row.type === "acknowledge") notFound();
  const challenge = parseChallenge(row);
  if (challenge.feedback_mode === "instant" || !challengeNeedsReview(challenge)) redirect(`/submissions/${id}`);

  const questions = await questionsForAttempt(challenge, profile.id, sub.attempt, false);
  const plan = planSteps({ questions, submission_spec: challenge.submission_spec });
  const formDraft = await prepareFormDraft(
    {
      challenge_version: sub.challenge_version,
      answers: sub.answers,
      figma_url: sub.figma_url,
      reflection: sub.reflection,
      image_paths: sub.image_paths,
      // Opens on the last step (Review), where every part is listed with its own Edit button.
      current_step: plan.steps.length,
      updated_at: sub.edited_at ?? sub.submitted_at,
    },
    { ...challenge, questions },
    profile.id,
    plan.steps.length,
  );
  const brief = briefView(challenge.body_md, challenge.title);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <Link
          href={`/submissions/${id}`}
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to attempt {sub.attempt}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit: {challenge.title}</h1>
      </div>

      <Alert data-testid="edit-notice">
        <Info aria-hidden />
        <AlertDescription>
          Your submission hasn&apos;t been reviewed yet, so you can still change it. Saving replaces what you sent; it
          stays the same attempt. Once it&apos;s reviewed, it can&apos;t be changed.
          {formDraft?.reset && " The challenge changed since you submitted, so some answers that no longer fit were left out."}
        </AlertDescription>
      </Alert>

      {plan.mode !== "single" ? (
        <SteppedChallengeForm
          slug={challenge.slug}
          userId={profile.id}
          version={challenge.version}
          questions={questions}
          spec={challenge.submission_spec}
          plan={plan}
          brief={plan.mode === "mixed" ? <Markdown>{brief.body}</Markdown> : undefined}
          tip={undefined}
          initialDraft={formDraft}
          attemptNumber={sub.attempt}
          maxAttempts={null}
          editing={{ submissionId: sub.id }}
        />
      ) : (
        <>
          <Markdown>{brief.body}</Markdown>
          <ChallengeForm
            slug={challenge.slug}
            userId={profile.id}
            questions={questions}
            spec={challenge.submission_spec}
            attemptNumber={sub.attempt}
            maxAttempts={null}
            editing={{
              submissionId: sub.id,
              answers: formDraft?.draft.answers ?? {},
              images: formDraft?.images ?? [],
              figmaUrl: formDraft?.draft.figmaUrl ?? "",
              reflection: formDraft?.draft.reflection ?? "",
            }}
          />
        </>
      )}
    </main>
  );
}
