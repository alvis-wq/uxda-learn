"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { countWords } from "@/lib/submissions/input";
import { submitChallenge } from "./actions";
import { ScreenshotUploader, type UploadedImage } from "./screenshot-uploader";

type Answers = Record<string, string | string[]>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

export function ChallengeForm({
  slug,
  userId,
  questions,
  spec,
  attemptNumber,
  maxAttempts,
}: {
  slug: string;
  userId: string;
  questions: PublicQuestion[];
  spec: SubmissionSpec;
  attemptNumber: number;
  maxAttempts: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [reflection, setReflection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        toast.success(res.status === "published" ? "Submitted and graded." : "Submitted — awaiting review.");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8" noValidate>
      {questions.map((q, i) => {
        const errId = `${q.id}-error`;
        const err = errors[`answers.${q.id}`];
        const legend = (
          <legend className="mb-3 font-medium">
            <span className="text-muted-foreground mr-2">{i + 1}.</span>
            {q.prompt}
            <span className="text-muted-foreground ml-2 text-sm font-normal">({q.points} pts)</span>
          </legend>
        );
        if (q.kind === "single") {
          return (
            <fieldset key={q.id} aria-describedby={err ? errId : undefined} aria-invalid={!!err}>
              {legend}
              <RadioGroup
                value={(answers[q.id] as string) ?? ""}
                onValueChange={(v) => setAnswer(q.id, v)}
                disabled={pending}
                className="gap-3"
              >
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-start gap-3">
                    <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} className="mt-0.5" />
                    <Label htmlFor={`${q.id}-${o.id}`} className="leading-snug font-normal">
                      {o.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <FieldError id={errId} message={err} />
            </fieldset>
          );
        }
        if (q.kind === "multi") {
          const selected = (answers[q.id] as string[]) ?? [];
          return (
            <fieldset key={q.id} aria-describedby={err ? errId : undefined} aria-invalid={!!err}>
              {legend}
              <div className="grid gap-3">
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`${q.id}-${o.id}`}
                      className="mt-0.5"
                      checked={selected.includes(o.id)}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        setAnswer(q.id, checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))
                      }
                    />
                    <Label htmlFor={`${q.id}-${o.id}`} className="leading-snug font-normal">
                      {o.label}
                    </Label>
                  </div>
                ))}
              </div>
              <FieldError id={errId} message={err} />
            </fieldset>
          );
        }
        const text = (answers[q.id] as string) ?? "";
        return (
          <fieldset key={q.id}>
            {legend}
            <Textarea
              id={`${q.id}-text`}
              aria-label={q.prompt}
              aria-invalid={!!err}
              aria-describedby={err ? errId : undefined}
              rows={6}
              value={text}
              disabled={pending}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {countWords(text)} words{q.min_words ? ` · at least ${q.min_words}` : ""}
            </p>
            <FieldError id={errId} message={err} />
          </fieldset>
        );
      })}

      {spec.screenshots && (
        <ScreenshotUploader
          userId={userId}
          slug={slug}
          label={spec.screenshots.label}
          min={spec.screenshots.min}
          max={spec.screenshots.max}
          images={images}
          onChange={setImages}
          error={errors.imagePaths}
          disabled={pending}
        />
      )}

      {spec.figma_url && (
        <div className="grid gap-2">
          <Label htmlFor="figma-url">
            Figma link{spec.figma_url.required ? "" : " (optional)"}
          </Label>
          <p className="text-muted-foreground text-sm">{spec.figma_url.label}</p>
          <Input
            id="figma-url"
            type="url"
            inputMode="url"
            placeholder="https://www.figma.com/design/…?node-id=…"
            value={figmaUrl}
            disabled={pending}
            aria-invalid={!!errors.figmaUrl}
            aria-describedby={errors.figmaUrl ? "figma-error" : undefined}
            onChange={(e) => setFigmaUrl(e.target.value)}
          />
          <FieldError id="figma-error" message={errors.figmaUrl} />
        </div>
      )}

      {spec.reflection && (
        <div className="grid gap-2">
          <Label htmlFor="reflection">Reflection{spec.reflection.required ? "" : " (optional)"}</Label>
          <p className="text-muted-foreground text-sm">{spec.reflection.prompt}</p>
          <Textarea
            id="reflection"
            rows={8}
            value={reflection}
            disabled={pending}
            aria-invalid={!!errors.reflection}
            aria-describedby={errors.reflection ? "reflection-error" : undefined}
            onChange={(e) => setReflection(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {countWords(reflection)} words
            {spec.reflection.min_words ? ` · at least ${spec.reflection.min_words}` : ""}
          </p>
          <FieldError id="reflection-error" message={errors.reflection} />
        </div>
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
          Attempt {attemptNumber} of {maxAttempts}
        </span>
      </div>
    </form>
  );
}
