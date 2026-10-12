"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { PublicQuestion } from "@/lib/content/schema";
import { countWords } from "@/lib/submissions/input";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/**
 * One question as a fieldset. Controlled and stateless: the caller owns the answer, so it survives the
 * Stepper unmounting this step. Pass `labelledBy` (the id of a heading that already shows the prompt) to
 * skip the visible legend.
 */
export function QuestionField({
  q,
  index,
  value,
  onChange,
  error,
  disabled,
  labelledBy,
}: {
  q: PublicQuestion;
  index: number;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  error?: string;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const errId = `${q.id}-error`;
  const legend = labelledBy ? null : (
    <legend className="mb-3 font-medium">
      <span className="text-muted-foreground mr-2">{index + 1}.</span>
      {q.prompt}
      <span className="text-muted-foreground text-meta ml-2 font-normal">({q.points} pts)</span>
    </legend>
  );

  if (q.kind === "single") {
    return (
      <fieldset aria-labelledby={labelledBy} aria-describedby={error ? errId : undefined} aria-invalid={!!error}>
        {legend}
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          disabled={disabled}
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
        <FieldError id={errId} message={error} />
      </fieldset>
    );
  }

  if (q.kind === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset aria-labelledby={labelledBy} aria-describedby={error ? errId : undefined} aria-invalid={!!error}>
        {legend}
        <div className="grid gap-3">
          {q.options.map((o) => (
            <div key={o.id} className="flex items-start gap-3">
              <Checkbox
                id={`${q.id}-${o.id}`}
                className="mt-0.5"
                checked={selected.includes(o.id)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))
                }
              />
              <Label htmlFor={`${q.id}-${o.id}`} className="leading-snug font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </div>
        <FieldError id={errId} message={error} />
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <fieldset aria-labelledby={labelledBy}>
      {legend}
      <Textarea
        id={`${q.id}-text`}
        aria-label={labelledBy ? undefined : q.prompt}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        rows={6}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-muted-foreground mt-1 text-xs">
        {countWords(text)} words{q.min_words ? ` · at least ${q.min_words}` : ""}
      </p>
      <FieldError id={errId} message={error} />
    </fieldset>
  );
}
