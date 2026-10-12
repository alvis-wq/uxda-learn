"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import Stepper, { Step } from "@/components/stepper/Stepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { clearDraft, draftKey, loadDraftRaw, parseDraft, saveDraft, type Draft } from "@/lib/submissions/draft";
import {
  clampStep,
  isComplete,
  stepForField,
  stepProblems,
  type StepDef,
  type StepPlan,
  type StepProblems,
} from "@/lib/submissions/steps";
import { submitChallenge } from "./actions";
import { QuestionField } from "./question-field";
import { ScreenshotUploader, useScreenshotUploads, type UploadedImage } from "./screenshot-uploader";
import { FigmaField, ReflectionField } from "./submission-fields";

type Fields = { answers: Record<string, string | string[]>; figmaUrl: string; reflection: string };
const EMPTY_FIELDS: Fields = { answers: {}, figmaUrl: "", reflection: "" };

type Props = {
  slug: string;
  userId: string;
  /** Content version: a changed challenge doesn't pick up an old draft. */
  version: number;
  questions: PublicQuestion[];
  spec: SubmissionSpec;
  plan: StepPlan;
  /** The brief (and how it's scored), rendered on the server; shown as the first step of a mixed challenge. */
  brief?: ReactNode;
  attemptNumber: number;
  maxAttempts: number;
};

const noop = () => () => {};

/**
 * A drafted challenge form in the React Bits Stepper. Server and first client render show a fresh form; once
 * hydrated it remounts once with whatever draft sessionStorage holds (so there's no hydration mismatch).
 */
export function SteppedChallengeForm(props: Props) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const key = draftKey(props.userId, props.slug, props.version);
  const draft = hydrated ? parseDraft(loadDraftRaw(key), props.questions, props.plan.steps.length) : null;
  return <Form key={hydrated ? "restored" : "fresh"} {...props} storageKey={key} initialDraft={draft} persist={hydrated} />;
}

function Form({
  slug,
  userId,
  questions,
  spec,
  plan,
  brief,
  attemptNumber,
  maxAttempts,
  storageKey,
  initialDraft,
  persist,
}: Props & { storageKey: string; initialDraft: Draft | null; persist: boolean }) {
  const router = useRouter();
  const challenge = useMemo(() => ({ slug, questions, submission_spec: spec }), [slug, questions, spec]);

  // Everything the learner has entered lives here, above the Stepper, which unmounts the steps they aren't on.
  const [fields, setFields] = useState<Fields>(
    initialDraft
      ? { answers: initialDraft.answers, figmaUrl: initialDraft.figmaUrl, reflection: initialDraft.reflection }
      : EMPTY_FIELDS,
  );
  const [images, setImages] = useState<UploadedImage[]>([]);
  const uploads = useScreenshotUploads({ userId, slug, max: spec.screenshots?.max ?? 0, images, setImages });

  const problems = useMemo(
    () => stepProblems(plan, challenge, userId, { ...fields, images, uploading: uploads.uploading }),
    [plan, challenge, userId, fields, images, uploads.uploading],
  );

  const [step, setStep] = useState(() => {
    if (!initialDraft) return 1;
    const restored = stepProblems(plan, challenge, userId, { ...fields, images: [], uploading: false });
    return clampStep(plan, restored, initialDraft.step);
  });
  // Focus only moves to a step's heading once the learner has navigated, never on first load.
  const [navigated, setNavigated] = useState(false);

  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = plan.steps[step - 1];
  const complete = isComplete(plan, problems);
  const blocker = current.kind === "review" ? null : (problems[current.id] ?? null);
  const blocked = pending || (current.kind === "review" ? !complete : Boolean(blocker));

  // Keep a draft so a refresh doesn't lose answers. Written after every change; cleared when empty. Not before
  // hydration: that first, empty instance must not wipe the draft the restored one is about to read.
  useEffect(() => {
    if (!persist) return;
    const untouched =
      step === 1 && !fields.figmaUrl && !fields.reflection && Object.keys(fields.answers).length === 0;
    if (untouched) clearDraft(storageKey);
    else saveDraft(storageKey, { ...fields, step });
  }, [persist, storageKey, fields, step]);

  const setAnswer = (id: string, value: string | string[]) =>
    setFields((f) => ({ ...f, answers: { ...f.answers, [id]: value } }));

  function goTo(target: number) {
    const next = clampStep(plan, problems, target);
    if (next === step) return;
    setStep(next);
    setNavigated(true);
  }

  function submit() {
    if (!complete || pending) return;
    setFormError(null);
    setServerErrors({});
    startTransition(async () => {
      try {
        const res = await submitChallenge(slug, {
          answers: fields.answers,
          imagePaths: images.map((i) => i.path),
          figmaUrl: fields.figmaUrl || null,
          reflection: fields.reflection || null,
        });
        if (!res.ok) {
          setFormError(res.error);
          setServerErrors(
            Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([field, message]) => [stepForField(plan, field), message])),
          );
          return;
        }
        clearDraft(storageKey);
        images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
        setFields(EMPTY_FIELDS);
        setImages([]);
        setStep(1);
        setNavigated(false);
        toast.success(res.status === "published" ? "Submitted and graded." : "Submitted — awaiting review.");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  const total = plan.steps.length;
  const stepNumber = (def: StepDef) => plan.steps.indexOf(def) + 1;
  const optional = (def: StepDef) =>
    (def.kind === "figma" && spec.figma_url && !spec.figma_url.required) ||
    (def.kind === "reflection" && spec.reflection && !spec.reflection.required);
  const eyebrow = (def: StepDef, extra?: string) =>
    [`Step ${stepNumber(def)} of ${total}`, optional(def) ? "Optional" : null, extra].filter(Boolean).join(" · ");

  function renderStep(def: StepDef): ReactNode {
    const isCurrent = def.id === current.id;
    const frame = { focusOnMount: navigated, blocker: isCurrent && def.kind !== "review" ? blocker : null };
    const headingId = `step-heading-${def.id}`;

    switch (def.kind) {
      case "brief":
        return (
          <StepFrame {...frame} headingId={headingId} eyebrow={eyebrow(def)} title="Brief">
            {brief}
          </StepFrame>
        );

      case "question": {
        const index = questions.findIndex((q) => q.id === def.questionId);
        const q = questions[index];
        return (
          <StepFrame
            {...frame}
            headingId={headingId}
            eyebrow={`Question ${index + 1} of ${questions.length} · ${q.points} pts`}
            title={q.prompt}
          >
            <QuestionField
              q={q}
              index={index}
              value={fields.answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
              error={serverErrors[def.id]}
              disabled={pending}
              labelledBy={headingId}
            />
          </StepFrame>
        );
      }

      case "questions":
        return (
          <StepFrame {...frame} headingId={headingId} eyebrow={eyebrow(def)} title="Questions">
            <div className="grid gap-8">
              {questions.map((q, i) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  index={i}
                  value={fields.answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                  disabled={pending}
                />
              ))}
            </div>
            {serverErrors[def.id] && <p role="alert" className="text-destructive text-sm">{serverErrors[def.id]}</p>}
          </StepFrame>
        );

      case "screenshots":
        return (
          spec.screenshots && (
            <StepFrame {...frame} headingId={headingId} eyebrow={eyebrow(def)} title="Screenshots">
              <ScreenshotUploader
                compact
                label={spec.screenshots.label}
                min={spec.screenshots.min}
                max={spec.screenshots.max}
                images={images}
                pending={uploads.pending}
                remaining={uploads.remaining}
                onAdd={uploads.add}
                onRemove={uploads.remove}
                uploadError={uploads.uploadError}
                error={serverErrors[def.id]}
                disabled={pending}
              />
            </StepFrame>
          )
        );

      case "figma":
        return (
          spec.figma_url && (
            <StepFrame {...frame} headingId={headingId} eyebrow={eyebrow(def)} title="Figma link">
              <p className="text-muted-foreground text-sm">{spec.figma_url.label}</p>
              <FigmaField
                compact
                spec={spec.figma_url}
                value={fields.figmaUrl}
                onChange={(v) => setFields((f) => ({ ...f, figmaUrl: v }))}
                error={serverErrors[def.id]}
                disabled={pending}
              />
            </StepFrame>
          )
        );

      case "reflection":
        return (
          spec.reflection && (
            <StepFrame {...frame} headingId={headingId} eyebrow={eyebrow(def)} title="Reflection">
              <p className="text-muted-foreground text-sm">{spec.reflection.prompt}</p>
              <ReflectionField
                compact
                spec={spec.reflection}
                value={fields.reflection}
                onChange={(v) => setFields((f) => ({ ...f, reflection: v }))}
                error={serverErrors[def.id]}
                disabled={pending}
              />
            </StepFrame>
          )
        );

      case "review":
        return (
          <StepFrame
            {...frame}
            blocker={null}
            headingId={headingId}
            eyebrow={eyebrow(def)}
            title={plan.mode === "quiz" ? "Review your answers" : "Review & submit"}
          >
            <Review
              plan={plan}
              questions={questions}
              fields={fields}
              images={images}
              problems={problems}
              serverErrors={serverErrors}
              onEdit={(id) => goTo(plan.steps.findIndex((s) => s.id === id) + 1)}
              disabled={pending}
            />
            {formError && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {!complete && (
              <p id="step-blocker" className="text-muted-foreground text-meta flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Finish the steps marked above before you submit.
              </p>
            )}
          </StepFrame>
        );
    }
  }

  return (
    <div className="grid gap-4">
      <Stepper
        step={step}
        onStepChange={goTo}
        onFinalStepCompleted={submit}
        indicator="bars"
        radius={32}
        frame={false}
        linear
        backButtonText="Back"
        nextButtonText="Continue"
        completeButtonText={pending ? "Submitting…" : "Submit"}
        completeIcon={pending ? <Loader2 className="animate-spin" size={16} aria-hidden /> : undefined}
        width="100%"
        backButtonProps={{ disabled: pending }}
        nextButtonProps={{ disabled: blocked, "aria-describedby": blocked && !pending ? "step-blocker" : undefined }}
      >
        {plan.steps.map((def) => (
          <Step key={def.id} title={def.title}>
            {renderStep(def)}
          </Step>
        ))}
      </Stepper>
      <p className="text-muted-foreground text-sm">
        Attempt {attemptNumber} of {maxAttempts}
      </p>
    </div>
  );
}

/** One step's content: an eyebrow, a heading that takes focus when the learner arrives, and why Continue is disabled. */
function StepFrame({
  headingId,
  eyebrow,
  title,
  focusOnMount,
  blocker,
  children,
}: {
  headingId: string;
  eyebrow: string;
  title: string;
  focusOnMount: boolean;
  blocker: string | null;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Captured at mount: this step takes focus only if it was mounted by the learner navigating to it.
  const takeFocus = useRef(focusOnMount);
  useEffect(() => {
    if (takeFocus.current) heading.current?.focus();
  }, []);

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <p className="text-muted-foreground text-meta">{eyebrow}</p>
        <h3 ref={heading} id={headingId} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          {title}
        </h3>
      </header>
      {children}
      {blocker && (
        <p id="step-blocker" className="text-muted-foreground text-meta flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {blocker}
        </p>
      )}
    </div>
  );
}

function Review({
  plan,
  questions,
  fields,
  images,
  problems,
  serverErrors,
  onEdit,
  disabled,
}: {
  plan: StepPlan;
  questions: PublicQuestion[];
  fields: Fields;
  images: UploadedImage[];
  problems: StepProblems;
  serverErrors: Record<string, string>;
  onEdit: (stepId: string) => void;
  disabled: boolean;
}) {
  const answerText = (q: PublicQuestion) => {
    const a = fields.answers[q.id];
    if (q.kind === "text") return typeof a === "string" && a.trim() ? a : null;
    const ids = Array.isArray(a) ? a : typeof a === "string" ? [a] : [];
    const labels = ids.map((id) => q.options.find((o) => o.id === id)?.label ?? id);
    return labels.length ? labels.join("; ") : null;
  };
  const empty = <span className="text-muted-foreground">Nothing added</span>;

  const sections = plan.steps
    .filter((s) => s.kind !== "brief" && s.kind !== "review")
    .map((s) => {
      let body: ReactNode;
      if (s.kind === "question") {
        const q = questions.find((x) => x.id === s.questionId)!;
        body = (
          <>
            <p className="font-medium">{q.prompt}</p>
            <p className="text-muted-foreground whitespace-pre-line">{answerText(q) ?? "—"}</p>
          </>
        );
      } else if (s.kind === "questions") {
        body = (
          <ol className="grid gap-3">
            {questions.map((q, i) => (
              <li key={q.id}>
                <p className="font-medium">
                  {i + 1}. {q.prompt}
                </p>
                <p className="text-muted-foreground whitespace-pre-line">{answerText(q) ?? "—"}</p>
              </li>
            ))}
          </ol>
        );
      } else if (s.kind === "screenshots") {
        body =
          images.length === 0 ? (
            empty
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => (
                <li key={img.path} className="overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={img.previewUrl} alt={img.name} className="aspect-video w-full object-cover" />
                </li>
              ))}
            </ul>
          );
      } else if (s.kind === "figma") {
        body = fields.figmaUrl ? <p className="break-all">{fields.figmaUrl}</p> : empty;
      } else {
        body = fields.reflection ? <p className="whitespace-pre-line">{fields.reflection}</p> : empty;
      }
      return { step: s, body, problem: serverErrors[s.id] ?? problems[s.id] };
    });

  return (
    <div className="grid gap-3">
      {sections.map(({ step, body, problem }) => (
        <section key={step.id} aria-label={step.title} className="grid gap-2 rounded-xl border p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-muted-foreground text-meta font-medium">{step.title}</h4>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onEdit(step.id)}>
              <Pencil aria-hidden />
              Edit<span className="sr-only"> {step.title}</span>
            </Button>
          </div>
          {body}
          {problem && (
            <p className="text-warning text-meta" role={serverErrors[step.id] ? "alert" : undefined}>
              {problem}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
