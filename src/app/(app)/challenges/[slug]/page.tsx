import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, FlaskConical, Info, Route } from "lucide-react";
import { ChallengeMeta } from "@/components/challenge-meta";
import { DraftBadge } from "@/components/draft-badge";
import { Markdown } from "@/components/markdown";
import { TipBox } from "@/components/tip-box";
import { WaitingNote } from "@/components/time-estimate";
import { RequiredBadges } from "@/components/required-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { briefView } from "@/lib/challenges/brief";
import { challengeNeedsReview } from "@/lib/challenges/model";
import { timeOf } from "@/lib/challenges/time";
import { questionsForAttempt } from "@/lib/data/attempt-order";
import { prepareFormDraft } from "@/lib/data/drafts";
import { getChallengePage } from "@/lib/data/learner";
import { parseInstantRun } from "@/lib/submissions/instant";
import { isResultVisible, maxAttemptsFor } from "@/lib/submissions/rules";
import { planSteps } from "@/lib/submissions/steps";
import { showsTestTotal } from "@/lib/submissions/testing";
import { formatDateTime } from "@/lib/utils";
import { AcknowledgeForm } from "./acknowledge-form";
import { ChallengeForm } from "./challenge-form";
import { BriefProvider, CollapsibleBrief } from "./collapsible-brief";
import { FeedbackForm } from "./feedback-form";
import { InstantQuizForm } from "./instant-quiz-form";
import { SteppedChallengeForm } from "./stepped-challenge-form";

export const metadata: Metadata = { title: "Challenge · UXDA Learn" };

export default async function ChallengePage({ params }: PageProps<"/challenges/[slug]">) {
  const { slug } = await params;
  const profile = await requireOnboardedProfile();
  const data = await getChallengePage(profile, slug);
  if (!data) notFound();
  const { challenge, categoryTitle, progress, attempts, preview, testing, draft, milestone } = data;
  // A locked milestone can't be opened: back to its roadmap (an admin preview still shows it).
  if (milestone?.locked && !preview) redirect(`/paths/${milestone.pathSlug}`);
  const { state } = progress;
  const isAck = challenge.type === "acknowledge";
  // A test attempt on a challenge with screenshots, Figma or written parts only has its questions marked: no total.
  const testTotal = showsTestTotal(challengeNeedsReview(challenge));

  // Each attempt shows the questions (and options, items) in its own order; grading goes by id.
  const attemptNumber = state.attemptsUsed + 1;
  const formOpen = !preview && !isAck && state.canSubmit;
  const questions = formOpen ? await questionsForAttempt(challenge, profile.id, attemptNumber, testing) : challenge.questions;
  const maxAttempts = testing ? null : maxAttemptsFor(challenge.feedback_mode);
  // Instant feedback: one question at a time, each checked on the server (instant-quiz-form.tsx).
  const instant = formOpen && challenge.feedback_mode === "instant" && questions.length > 0;

  // Multi-step challenges fill in a Stepper. A mixed challenge's brief is its first step, so it's only
  // shown above the page when there's no stepper (preview, no attempts left, single-step, acknowledge).
  const plan = planSteps({ questions, submission_spec: challenge.submission_spec });
  const stepped = instant || (formOpen && plan.mode !== "single");
  const briefInStepper = stepped && !instant && plan.mode === "mixed";
  const tip = challenge.tip ? <TipBox>{challenge.tip}</TipBox> : undefined;
  // The saved draft is only read into the form when the form is shown.
  const initialDraft =
    stepped && !instant && draft ? await prepareFormDraft(draft, challenge, profile.id, plan.steps.length) : null;
  const instantRun = instant ? parseInstantRun(draft?.instant_tries, testing) : {};

  // The brief without a leading heading that repeats the page title (the files stay as they are). Once the learner
  // has started, a stepped challenge shows only its first paragraph, with a toggle for the rest.
  const brief = briefView(challenge.body_md, challenge.title);

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

  const briefFull = (
    <div className="grid gap-8">
      <Markdown>{brief.body}</Markdown>
      {rubric}
    </div>
  );
  const briefShort = brief.hasMore || rubric ? <Markdown>{brief.first}</Markdown> : null;
  // A quiz-style stepper has no brief step: the brief sits above the form and shrinks as the learner gets going.
  const collapsibleBrief = <CollapsibleBrief full={briefFull} short={briefShort} />;

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <BriefProvider initialStarted={initialDraft !== null || Object.keys(instantRun).length > 0}>
        <div>
          {milestone ? (
            <>
              <Link
                href={`/paths/${milestone.pathSlug}`}
                className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
                data-testid="back-to-path"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Back to path
              </Link>
              <p className="text-brand-text text-meta mb-1 flex items-center gap-1.5 font-medium" data-testid="milestone-position">
                <Route className="size-4" aria-hidden />
                Milestone {milestone.position} of {milestone.total}
                <span className="text-muted-foreground font-normal">· {milestone.pathTitle}</span>
              </p>
            </>
          ) : (
            <Link
              href={`/categories/${challenge.category_slug}`}
              className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {categoryTitle}
            </Link>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{challenge.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {testing && <DraftBadge />}
              <StatusBadge
                status={testing ? null : state.latest?.status}
                acknowledged={isAck ? progress.done : undefined}
                inProgress={progress.inProgress}
              />
            </div>
          </div>
          <div className="mt-2 grid gap-2">
            {!testing && <RequiredBadges required={progress.required} dueAt={challenge.due_at} done={progress.done} />}
            {/* A milestone inherits its path's required / due date (the path counts, not the milestone). */}
            {!testing && milestone?.pathRequirement && (
              <RequiredBadges
                required={milestone.pathRequirement.required}
                dueAt={milestone.pathRequirement.dueAt}
                done={milestone.pathRequirement.allSubmitted}
              />
            )}
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

        {testing && (
          <Alert data-testid="testing-notice">
            <FlaskConical aria-hidden />
            <AlertDescription>
              You&apos;re testing a draft. Your attempts here are test attempts: they don&apos;t count towards points, the
              leaderboard or your attempt limit, and there&apos;s no limit on how many you make. Your results show the correct
              answers so you can check them. When this challenge is published you start fresh.
            </AlertDescription>
          </Alert>
        )}

        {(timeOf(challenge)?.waiting ?? 0) > 0 && <WaitingNote />}

        {!briefInStepper && (stepped ? collapsibleBrief : briefFull)}

        {attempts.length > 0 && (
          <section aria-labelledby="attempts-heading" className="grid gap-3">
            <h2 id="attempts-heading" className="text-lg font-semibold">
              {testing ? "Your test attempts" : "Your attempts"}
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
                            {a.is_test ? "Test attempt" : "Attempt"} {a.attempt}
                          </Link>
                          {a.is_imported && (
                            <Badge variant="outline" className="ml-2 align-middle" data-testid="imported-badge">
                              Imported
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-meta ml-2 font-normal">
                            {new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        </CardTitle>
                        <div className="flex items-center gap-3">
                          {isResultVisible(a.status) && a.final_score !== null && (!a.is_test || testTotal) && (
                            <span className="text-meta font-medium" data-testid="attempt-score">
                              {a.final_score} / {a.max_score}
                            </span>
                          )}
                          {a.is_test ? <Badge variant="outline">Test</Badge> : <StatusBadge status={a.status} />}
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

        {/* Any attempt opens the next milestone: no need to wait for a review. */}
        {!preview && milestone?.next && attempts.length > 0 && (
          <Link
            href={`/challenges/${milestone.next.slug}`}
            className="hover:border-primary group flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            data-testid="next-milestone"
          >
            <span className="grid min-w-0">
              <span className="text-muted-foreground text-meta">Next: milestone {milestone.position + 1}</span>
              <span className="truncate font-medium">{milestone.next.title}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        )}

        {!preview && isAck && (
          <section aria-labelledby="ack-heading" className="grid gap-4">
            <h2 id="ack-heading" className="text-lg font-semibold">
              Your confirmation
            </h2>
            {testing ? (
              <Alert data-testid="ack-testing">
                <Info aria-hidden />
                <AlertDescription>
                  This is a draft, so confirming is switched off while you test it. Read the brief above; nothing is recorded.
                </AlertDescription>
              </Alert>
            ) : progress.acknowledgedAt ? (
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
          <section id="submit" aria-labelledby="submit-heading" className="grid scroll-mt-6 gap-3">
            {/* With a stepper the step label above each question is the heading: keep this one for screen readers only. */}
            <h2 id="submit-heading" className={state.canSubmit && stepped ? "sr-only" : "text-lg font-semibold"}>
              {testing ? (attempts.length ? "Test again" : "Test it") : attempts.length ? "Submit again" : "Your submission"}
            </h2>
            {instant ? (
              <InstantQuizForm
                slug={challenge.slug}
                version={challenge.version}
                questions={questions}
                initialRun={instantRun}
                tip={tip}
                attemptNumber={attemptNumber}
                maxAttempts={maxAttempts}
              />
            ) : state.canSubmit && stepped ? (
              <SteppedChallengeForm
                // A new attempt (after a submit) starts a new form: fresh state, autosave on again.
                key={state.attemptsUsed}
                slug={challenge.slug}
                userId={profile.id}
                version={challenge.version}
                questions={questions}
                spec={challenge.submission_spec}
                plan={plan}
                brief={briefInStepper ? collapsibleBrief : undefined}
                tip={tip}
                initialDraft={initialDraft}
                attemptNumber={attemptNumber}
                maxAttempts={maxAttempts}
              />
            ) : state.canSubmit ? (
              <ChallengeForm
                slug={challenge.slug}
                userId={profile.id}
                questions={questions}
                spec={challenge.submission_spec}
                tip={tip}
                attemptNumber={attemptNumber}
                maxAttempts={maxAttempts}
              />
            ) : (
              <Alert>
                <Info aria-hidden />
                <AlertDescription>{state.reason}</AlertDescription>
              </Alert>
            )}
          </section>
        )}

        {testing && (
          <section aria-label="Feedback for Alvis" className="border-t pt-8">
            <FeedbackForm slug={challenge.slug} />
          </section>
        )}
      </BriefProvider>
    </main>
  );
}
