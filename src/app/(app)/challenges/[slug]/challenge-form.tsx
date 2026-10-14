"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { submitChallenge } from "./actions";
import { QuestionField } from "./question-field";
import { ScreenshotUploader, useScreenshotUploads, type UploadedImage } from "./screenshot-uploader";
import { FigmaField, ReflectionField } from "./submission-fields";

type Answers = Record<string, string | string[]>;

export function ChallengeForm({
  slug,
  userId,
  questions,
  spec,
  tip,
  attemptNumber,
  maxAttempts,
}: {
  slug: string;
  userId: string;
  questions: PublicQuestion[];
  spec: SubmissionSpec;
  /** The challenge's `tip`, rendered on the server. */
  tip?: ReactNode;
  attemptNumber: number;
  /** null for a test attempt (no limit). */
  maxAttempts: number | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const uploads = useScreenshotUploads({ userId, slug, max: spec.screenshots?.max ?? 0, images, setImages });

  const setAnswer = (id: string, value: string | string[]) => setAnswers((a) => ({ ...a, [id]: value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    startTransition(async () => {
      try {
        const res = await submitChallenge(slug, {
          answers,
          imagePaths: images.map((i) => i.path),
          figmaUrl: figmaUrl || null,
          reflection: reflection || null,
        });
        if (!res.ok) {
          setFormError(res.error);
          setErrors(res.fieldErrors ?? {});
          return;
        }
        if (res.status === "published") {
          // Graded on the spot: show the result (score and ✓/✗ per question) straight away.
          toast.success("Submitted and graded.");
          router.push(`/submissions/${res.submissionId}`);
          return;
        }
        toast.success("Submitted — awaiting review.");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8" noValidate>
      {questions.length > 0 && tip}
      {questions.map((q, i) => (
        <QuestionField
          key={q.id}
          q={q}
          index={i}
          value={answers[q.id]}
          onChange={(v) => setAnswer(q.id, v)}
          error={errors[`answers.${q.id}`]}
          disabled={pending}
        />
      ))}

      {spec.screenshots && (
        <ScreenshotUploader
          label={spec.screenshots.label}
          min={spec.screenshots.min}
          max={spec.screenshots.max}
          images={images}
          pending={uploads.pending}
          remaining={uploads.remaining}
          onAdd={uploads.add}
          onRemove={uploads.remove}
          uploadError={uploads.uploadError}
          error={errors.imagePaths}
          disabled={pending}
        />
      )}

      {spec.figma_url && (
        <FigmaField spec={spec.figma_url} value={figmaUrl} onChange={setFigmaUrl} error={errors.figmaUrl} disabled={pending} />
      )}

      {spec.reflection && (
        <ReflectionField
          spec={spec.reflection}
          value={reflection}
          onChange={setReflection}
          error={errors.reflection}
          disabled={pending}
        />
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? "Submitting…" : "Submit"}
        </Button>
        <span className="text-muted-foreground text-sm">
          {maxAttempts === null ? `Test attempt ${attemptNumber}` : `Attempt ${attemptNumber} of ${maxAttempts}`}
        </span>
      </div>
    </form>
  );
}
