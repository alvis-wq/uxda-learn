import { z } from "zod";
import type { Challenge } from "@/lib/challenges/model";

export const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 20_000;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isFigmaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "figma.com" || url.hostname.endsWith(".figma.com"));
  } catch {
    return false;
  }
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Storage path the client must upload to: {user_id}/{challenge_slug}/{uuid}.{ext} */
export function isOwnImagePath(path: string, userId: string, slug: string): boolean {
  const re = new RegExp(`^${UUID}/[a-z0-9-]+/${UUID}\\.(png|jpg|webp)$`);
  return re.test(path) && path.startsWith(`${userId}/${slug}/`);
}

export type SubmissionInput = {
  answers: Record<string, string | string[]>;
  imagePaths: string[];
  figmaUrl: string | null;
  reflection: string | null;
};

/** Build a Zod schema for one challenge's submission, derived from its questions and spec. */
export function submissionInputSchema(
  challenge: Pick<Challenge, "slug" | "questions" | "submission_spec">,
  userId: string,
) {
  const answerShape: Record<string, z.ZodType<string | string[]>> = {};
  for (const q of challenge.questions) {
    if (q.kind === "single") {
      answerShape[q.id] = z.enum(q.options.map((o) => o.id) as [string, ...string[]], {
        error: "Choose an answer.",
      });
    } else if (q.kind === "order") {
      const ids = q.items.map((i) => i.id) as [string, ...string[]];
      answerShape[q.id] = z
        .array(z.enum(ids), { error: "Put the items in order." })
        .length(ids.length, "Put the items in order.")
        .refine((a) => new Set(a).size === a.length, "Each item can only be used once.");
    } else if (q.kind === "multi") {
      const ids = q.options.map((o) => o.id) as [string, ...string[]];
      answerShape[q.id] = z
        .array(z.enum(ids), { error: "Choose at least one option." })
        .min(1, "Choose at least one option.")
        .refine((a) => new Set(a).size === a.length, "Each option can only be chosen once.");
    } else {
      answerShape[q.id] = z
        .string({ error: "Write an answer." })
        .trim()
        .min(1, "Write an answer.")
        .max(MAX_TEXT, "Answer is too long.")
        .refine((t) => !q.min_words || countWords(t) >= q.min_words, `Write at least ${q.min_words} words.`);
    }
  }

  const spec = challenge.submission_spec;
  const shots = spec.screenshots;
  const imagePaths = z
    .array(z.string())
    .max(shots?.max ?? 0, shots ? `Upload at most ${shots.max} screenshots.` : "Screenshots aren't part of this challenge.")
    .min(shots?.min ?? 0, `Upload at least ${shots?.min ?? 0} screenshot(s).`)
    .refine((p) => new Set(p).size === p.length, "Duplicate screenshot.")
    .refine((p) => p.every((x) => isOwnImagePath(x, userId, challenge.slug)), "Invalid screenshot upload.");

  const figma = spec.figma_url;
  const figmaUrl = z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !figma?.required || v !== null, "Add your Figma link.")
    .refine((v) => v === null || (figma !== undefined && isFigmaUrl(v)), "Use an https://www.figma.com/… link.");

  const refl = spec.reflection;
  const reflection = z
    .string()
    .trim()
    .max(MAX_TEXT, "Reflection is too long.")
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !refl?.required || v !== null, "Write your reflection.")
    .refine((v) => v === null || refl !== undefined, "Reflection isn't part of this challenge.")
    .refine(
      (v) => v === null || !refl?.min_words || countWords(v) >= refl.min_words,
      `Write at least ${refl?.min_words ?? 0} words.`,
    );

  return z.object({
    answers: z.strictObject(answerShape),
    imagePaths,
    figmaUrl,
    reflection,
  });
}

export type DraftInput = {
  /** The content version the learner's form was rendered from. */
  version: number;
  /** 1-based Stepper step. */
  step: number;
  answers: Record<string, string | string[]>;
  imagePaths: string[];
  figmaUrl: string;
  reflection: string;
};

/**
 * The same fields as a submission, validated for what they are rather than for being finished: an answer may be
 * missing, empty or too short, a Figma link half typed. What must still hold is what a stored draft could otherwise
 * smuggle in: known question ids and options, the learner's own screenshot paths (at most the allowed number),
 * fields the challenge doesn't have left empty, and bounded text. A complete, valid submission always passes.
 */
export function draftInputSchema(
  challenge: Pick<Challenge, "slug" | "questions" | "submission_spec">,
  userId: string,
  stepCount: number,
) {
  const answerShape: Record<string, z.ZodType<string | string[]>> = {};
  for (const q of challenge.questions) {
    if (q.kind === "text") {
      answerShape[q.id] = z.string().max(MAX_TEXT, "Answer is too long.");
    } else {
      const ids = (q.kind === "order" ? q.items : q.options).map((o) => o.id) as [string, ...string[]];
      answerShape[q.id] =
        q.kind === "single"
          ? z.enum(ids)
          : z.array(z.enum(ids)).refine((a) => new Set(a).size === a.length, "Each option can only be chosen once.");
    }
  }

  const spec = challenge.submission_spec;
  return z.object({
    version: z.number().int().positive(),
    step: z.number().int().min(1).max(Math.max(stepCount, 1)),
    answers: z.strictObject(answerShape).partial(),
    imagePaths: z
      .array(z.string())
      .max(spec.screenshots?.max ?? 0, "Too many screenshots.")
      .refine((p) => new Set(p).size === p.length, "Duplicate screenshot.")
      .refine((p) => p.every((x) => isOwnImagePath(x, userId, challenge.slug)), "Invalid screenshot upload."),
    figmaUrl: z.string().max(2000).refine((v) => v === "" || spec.figma_url !== undefined, "A Figma link isn't part of this challenge."),
    reflection: z
      .string()
      .max(MAX_TEXT, "Reflection is too long.")
      .refine((v) => v === "" || spec.reflection !== undefined, "Reflection isn't part of this challenge."),
  });
}
