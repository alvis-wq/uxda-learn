import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Eye, Info } from "lucide-react";
import { ChallengeMeta } from "@/components/challenge-meta";
import { Markdown } from "@/components/markdown";
import { TipBox } from "@/components/tip-box";
import { RequiredBadges } from "@/components/required-badge";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { prepareFormDraft } from "@/lib/data/drafts";
import { getChallengePage } from "@/lib/data/learner";
import { isResultVisible, MAX_ATTEMPTS } from "@/lib/submissions/rules";
import { planSteps } from "@/lib/submissions/steps";
import { formatDateTime } from "@/lib/utils";
import { AcknowledgeForm } from "./acknowledge-form";
import { ChallengeForm } from "./challenge-form";
import { SteppedChallengeForm } from "./stepped-challenge-form";

export const metadata: Metadata = { title: "Challenge · UXDA Learn" };

export default async function ChallengePage({ params }: PageProps<"/challenges/[slug]">) {
  const { slug } = await params;
  const profile = await requireOnboardedProfile();
  const data = await getChallengePage(profile, slug);
  if (!data) notFound();
  const { challenge, categoryTitle, progress, attempts, preview, draft } = data;
  const { state } = progress;
  const isAck = challenge.type === "acknowledge";

  // Multi-step challenges fill in a Stepper. A mixed challenge's brief is its first step, so it's only
  // shown above the page when there's no stepper (preview, no attempts left, single-step, acknowledge).
  const plan = planSteps({ questions: challenge.questions, submission_spec: challenge.submission_spec });
  const stepped = !preview && !isAck && state.canSubmit && plan.mode !== "single";
  const briefInStepper = stepped && plan.mode === "mixed";
  const tip = challenge.tip ? <TipBox>{challenge.tip}</TipBox> : undefined;
  // The saved draft is only read into the form when the form is shown.
  const initialDraft =
    stepped && draft ? await prepareFormDraft(draft, challenge, profile.id, plan.steps.length) : null;

  const rubric = challenge.rubric.length > 0 && (
    <section aria-labelledby="rubric-heading" className="grid gap-3">
      <h2 id="rubric-heading" className="text-lg font-semibold">
        How it&apos;s scored
      </h2>
      <ul className="grid gap-2">
        {challenge.rubric.map((r) => (
          <li key={r.id} className="flex justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
            <span>{r.criterion}</span>
            <span className="text-muted-foreground text-meta shrink-0">{r.points} pts</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-10">
      <div>
        <Link
          href={`/categories/${challenge.category_slug}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {categoryTitle}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{challenge.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={state.latest?.status}
              acknowledged={isAck ? progress.done : undefined}
              inProgress={progress.inProgress}
            />
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          <RequiredBadges required={progress.required} dueAt={challenge.due_at} done={progress.done} />
          <ChallengeMeta challenge={challenge} />
        </div>
      </div>

      {preview && (
        <Alert>
          <Eye aria-hidden />
          <AlertDescription>
            Admin preview — this challenge is {challenge.status} and not visible to learners on your track.
          </AlertDescription>
        </Alert>
      )}

      {!briefInStepper && (
        <>
          <Markdown>{challenge.body_md}</Markdown>
          {rubric}
        </>
      )}

      {attempts.length > 0 && (
        <section aria-labelledby="attempts-heading" className="grid gap-3">
          <h2 id="attempts-heading" className="text-lg font-semibold">
            Your attempts
          </h2>
          <ul className="grid gap-3">
            {attempts
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <Card className="gap-3 py-4">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4">
                      <CardTitle className="text-sm">
                        <Link href={`/submissions/${a.id}`} className="hover:underline">
                          Attempt {a.attempt}
                        </Link>
                        <span className="text-muted-foreground text-meta ml-2 font-normal">
                          {new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        {isResultVisible(a.status) && a.final_score !== null && (
                          <span className="text-meta font-medium" data-testid="attempt-score">
                            {a.final_score} / {a.max_score}
                          </span>
                        )}
                        <StatusBadge status={a.status} />
                      </div>
                    </CardHeader>
                    {isResultVisible(a.status) && a.feedback && (
                      <CardContent className="px-4 text-sm whitespace-pre-line">{a.feedback}</CardContent>
                    )}
                  </Card>
                </li>
              ))}
          </ul>
        </section>
      )}

      {!preview && isAck && (
        <section aria-labelledby="ack-heading" className="grid gap-4">
          <h2 id="ack-heading" className="text-lg font-semibold">
            Your confirmation
          </h2>
          {progress.acknowledgedAt ? (
            <Alert data-testid="acknowledged">
              <CheckCircle2 aria-hidden />
              <AlertDescription>You confirmed you read and understood this on {formatDateTime(progress.acknowledgedAt)}.</AlertDescription>
            </Alert>
          ) : (
            <AcknowledgeForm slug={challenge.slug} />
          )}
        </section>
      )}

      {!preview && !isAck && (
        <section aria-labelledby="submit-heading" className="grid gap-4">
          <h2 id="submit-heading" className="text-lg font-semibold">
            {attempts.length ? "Submit again" : "Your submission"}
          </h2>
          {state.canSubmit && stepped ? (
            <SteppedChallengeForm
              // A new attempt (after a submit) starts a new form: fresh state, autosave on again.
              key={state.attemptsUsed}
              slug={challenge.slug}
              userId={profile.id}
              version={challenge.version}
              questions={challenge.questions}
              spec={challenge.submission_spec}
              plan={plan}
              brief={
                briefInStepper ? (
                  <div className="grid gap-8">
                    <Markdown>{challenge.body_md}</Markdown>
                    {rubric}
                  </div>
                ) : undefined
              }
              tip={tip}
              initialDraft={initialDraft}
              attemptNumber={state.attemptsUsed + 1}
              maxAttempts={MAX_ATTEMPTS}
            />
          ) : state.canSubmit ? (
            <ChallengeForm
              slug={challenge.slug}
              userId={profile.id}
              questions={challenge.questions}
              spec={challenge.submission_spec}
              tip={tip}
              attemptNumber={state.attemptsUsed + 1}
              maxAttempts={MAX_ATTEMPTS}
            />
          ) : (
            <Alert>
              <Info aria-hidden />
              <AlertDescription>{state.reason}</AlertDescription>
            </Alert>
          )}
        </section>
      )}
    </main>
  );
}
