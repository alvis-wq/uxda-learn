"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SubmissionSpec } from "@/lib/content/schema";
import { countWords } from "@/lib/submissions/input";
import { FieldError } from "./question-field";

/**
 * The Figma link and reflection inputs, controlled and stateless (the caller owns the values). With `compact`
 * the visible label and prompt are left out because the surrounding Stepper step already shows them; the label
 * stays for screen readers.
 */
export function FigmaField({
  spec,
  value,
  onChange,
  error,
  disabled,
  compact,
}: {
  spec: NonNullable<SubmissionSpec["figma_url"]>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="figma-url" className={compact ? "sr-only" : undefined}>
        Figma link{spec.required ? "" : " (optional)"}
      </Label>
      {!compact && <p className="text-muted-foreground text-sm">{spec.label}</p>}
      <Input
        id="figma-url"
        type="url"
        inputMode="url"
        placeholder="https://www.figma.com/design/…?node-id=…"
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? "figma-error" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError id="figma-error" message={error} />
    </div>
  );
}

export function ReflectionField({
  spec,
  value,
  onChange,
  error,
  disabled,
  compact,
}: {
  spec: NonNullable<SubmissionSpec["reflection"]>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="reflection" className={compact ? "sr-only" : undefined}>
        Reflection{spec.required ? "" : " (optional)"}
      </Label>
      {!compact && <p className="text-muted-foreground text-sm">{spec.prompt}</p>}
      <Textarea
        id="reflection"
        rows={8}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? "reflection-error" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        {countWords(value)} words
        {spec.min_words ? ` · at least ${spec.min_words}` : ""}
      </p>
      <FieldError id="reflection-error" message={error} />
    </div>
  );
}
