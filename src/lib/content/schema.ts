import { z } from "zod";
import { TRACK_VALUES, type Audience } from "@/lib/tracks";

/** Zod schemas for /content. Spec: docs/content-format.md. */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (a-z, 0-9, hyphens)");
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i, "must be a simple id (letters, digits, - or _)");
const nonEmpty = z.string().trim().min(1, "must not be empty");

/**
 * Card artwork: a file name in public/challenges/ (no folders). The file's existence is checked in validate.ts.
 * Keep the pattern in step with the check constraint in supabase/migrations/20261012090000_challenge_images.sql.
 */
export const IMAGE_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;
const imageFile = z
  .string()
  .regex(IMAGE_FILE_PATTERN, "must be a file name in public/challenges/ ending in .png, .jpg, .webp or .avif (lowercase, no folders)");

export const trackSchema = z.enum(TRACK_VALUES);

/**
 * `all`, or a list of tracks. Always normalised to an array: ["all"] or [track, ...].
 * `[all]` is accepted too; mixing `all` with tracks is not.
 */
export const audiencesSchema = z
  .union([z.literal("all"), z.array(z.union([z.literal("all"), trackSchema])).min(1, "needs at least one track")])
  .transform((v): Audience[] => (v === "all" ? ["all"] : v))
  .refine((a) => !a.includes("all") || a.length === 1, '"all" can\'t be combined with tracks')
  .refine((a) => new Set(a).size === a.length, "lists a track twice");

/** `audience` was replaced by `audiences`; give a pointed error instead of "unrecognized key". */
const legacyAudience = z
  .never({ error: "`audience` was replaced by `audiences` (a list of tracks, or `all`)" })
  .optional();

export const challengeTypeSchema = z.enum(["quiz", "screenshot", "figma", "mixed", "acknowledge"]);
export const challengeStatusSchema = z.enum(["draft", "published", "archived"]);

export const categorySchema = z.strictObject({
  slug,
  title: nonEmpty,
  audiences: audiencesSchema,
  audience: legacyAudience,
  description: z.string().trim().optional(),
  sort_order: z.number().int().default(0),
  image: imageFile.optional(), // default artwork for the category's challenges
});

export const categoriesFileSchema = z.strictObject({
  categories: z.array(categorySchema).min(1, "at least one category is required"),
});

const optionSchema = z.strictObject({ id, label: nonEmpty });
const points = z.number().int().positive("must be a positive integer");

const singleQuestionSchema = z.strictObject({
  id,
  kind: z.literal("single"),
  prompt: nonEmpty,
  options: z.array(optionSchema).min(2, "needs at least 2 options"),
  answer: id,
  points,
});

const multiQuestionSchema = z.strictObject({
  id,
  kind: z.literal("multi"),
  prompt: nonEmpty,
  options: z.array(optionSchema).min(2, "needs at least 2 options"),
  answer: z.array(id).min(1, "needs at least one correct option"),
  points,
});

/** Drag items into the right order. Authors list `items` in the CORRECT order; sync stores them shuffled (see order.ts). */
const orderQuestionSchema = z.strictObject({
  id,
  kind: z.literal("order"),
  prompt: nonEmpty,
  items: z.array(optionSchema).min(2, "needs at least 2 items"),
  points,
});

const textQuestionSchema = z.strictObject({
  id,
  kind: z.literal("text"),
  prompt: nonEmpty,
  min_words: z.number().int().positive().optional(),
  points,
});

export const questionSchema = z.discriminatedUnion("kind", [
  singleQuestionSchema,
  multiQuestionSchema,
  orderQuestionSchema,
  textQuestionSchema,
]);

export const submissionSpecSchema = z.strictObject({
  screenshots: z
    .strictObject({
      min: z.number().int().min(0),
      max: z.number().int().min(1).max(10),
      label: nonEmpty,
    })
    .refine((s) => s.min <= s.max, "screenshots.min must be <= screenshots.max")
    .optional(),
  figma_url: z.strictObject({ required: z.boolean(), label: nonEmpty }).optional(),
  reflection: z
    .strictObject({
      required: z.boolean(),
      min_words: z.number().int().positive().optional(),
      prompt: nonEmpty,
    })
    .optional(),
});

export const rubricCriterionSchema = z.strictObject({
  id,
  criterion: nonEmpty,
  points,
  levels: z.strictObject({ full: nonEmpty, partial: nonEmpty, none: nonEmpty }),
});

/** Questions as stored in challenges.questions (answers stripped). */
export const publicQuestionSchema = z.discriminatedUnion("kind", [
  singleQuestionSchema.omit({ answer: true }),
  multiQuestionSchema.omit({ answer: true }),
  orderQuestionSchema, // as stored: the items are already shuffled, so this never shows the answer
  textQuestionSchema,
]);

export const challengeFrontmatterSchema = z.strictObject({
  slug,
  title: nonEmpty,
  category: slug,
  audiences: audiencesSchema.optional(), // defaults to the category's audiences
  audience: legacyAudience,
  required_for: audiencesSchema.optional(), // omitted = optional for everyone
  type: challengeTypeSchema,
  // Optional only for `acknowledge` (checked in validate.ts).
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  points: z.number().int().min(0, "must be 0 or more").optional(),
  estimated_minutes: z.number().int().positive().optional(),
  // Part of estimated_minutes spent waiting while Claude Code works (checked in validate.ts: needs estimated_minutes, at most it).
  waiting_minutes: z.number().int().min(0, "must be 0 or more").optional(),
  status: challengeStatusSchema.default("draft"),
  summary: z.string().trim().max(300).optional(),
  image: imageFile.optional(), // overrides the category's image
  due_at: z.iso.datetime({ offset: true }).optional(),
  tip: z.string().trim().min(1, "must not be empty").max(1000, "keep the tip short (at most 1000 characters)").optional(), // markdown hint above the questions
  questions: z.array(questionSchema).default([]),
  submission: submissionSpecSchema.optional(),
  rubric: z.array(rubricCriterionSchema).default([]),
  grader_notes: z.string().optional(),
  path: slug.optional(), // a milestone of this learning path (content/paths/<slug>.yaml); listed only inside it
});

/** A learning path: one card that opens a roadmap of milestone challenges (content/paths/<slug>.yaml). */
export const pathFileSchema = z.strictObject({
  slug,
  title: nonEmpty,
  category: slug,
  audiences: audiencesSchema.optional(), // defaults to the category's audiences
  summary: nonEmpty.max(160, "keep the summary to one short sentence (at most 160 characters)"),
  sequential: z.boolean().default(true),
  milestones: z.array(slug).min(2, "a path needs at least 2 milestones"),
  /** Paths that come first: this one stays locked until each has every milestone submitted. */
  requires: z.array(slug).default([]),
  /** Optional markdown shown in a "Before you start" box at the top of the path page (what to have set up first). */
  before_you_start: nonEmpty.max(600, "keep it short (at most 600 characters)").optional(),
  before_you_submit: z.array(nonEmpty.max(200, "keep each line short (at most 200 characters)")).max(8, "at most 8 lines").default([]),
  status: challengeStatusSchema.default("draft"), // initial value only, like a challenge's
  // Initial values only, like status: required for these tracks (counts as one required item), and its due date.
  required_for: audiencesSchema.optional(),
  due_at: z.iso.datetime({ offset: true }).optional(),
});

export type Category = z.infer<typeof categorySchema>;
export type Question = z.infer<typeof questionSchema>;
export type SubmissionSpec = z.infer<typeof submissionSpecSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type ChallengeFrontmatter = z.infer<typeof challengeFrontmatterSchema>;
export type PathFile = z.infer<typeof pathFileSchema>;

/** A question as shown to users: never includes the answer. */
export type PublicQuestion =
  | Omit<Extract<Question, { kind: "single" }>, "answer">
  | Omit<Extract<Question, { kind: "multi" }>, "answer">
  | Extract<Question, { kind: "order" }>
  | Extract<Question, { kind: "text" }>;

export const AUTO_GRADED_KINDS = ["single", "multi", "order"] as const;

export function isAutoGraded(q: Question | PublicQuestion): boolean {
  return q.kind !== "text";
}

/** The options (single / multi) or items (order) of a question; null for a text question. */
export function choicesOf(q: Question | PublicQuestion): { id: string; label: string }[] | null {
  if (q.kind === "text") return null;
  return q.kind === "order" ? q.items : q.options;
}

/** True when a submission needs human/AI review (anything beyond auto-graded questions). */
export function needsReview(c: {
  questions: readonly (Question | PublicQuestion)[];
  submission?: SubmissionSpec;
}): boolean {
  const s = c.submission;
  return (
    c.questions.some((q) => !isAutoGraded(q)) ||
    Boolean(s && (s.screenshots || s.figma_url || s.reflection))
  );
}
