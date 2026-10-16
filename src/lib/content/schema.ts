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
 * Keep the pattern in step with the check constraints in supabase/migrations/20261012090000_challenge_images.sql and
 * 20261021090000_path_images.sql.
 */
export const IMAGE_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;
const imageFile = z
  .string()
  .regex(IMAGE_FILE_PATTERN, "must be a file name in public/challenges/ ending in .png, .jpg, .webp or .avif (lowercase, no folders)");

/**
 * Hand tuning of a card illustration (needs `image` in the same file; checked in validate.ts). Scale multiplies its
 * width, anchored bottom-right; offsets move it by a % of its own size (x right, y down). Keep the ranges in step with
 * supabase/migrations/20261022090000_image_tuning.sql.
 */
const imageTuning = {
  image_scale: z.number().min(0.5, "must be at least 0.5").max(2, "must be at most 2").optional(),
  image_offset_x: z.number().min(-50, "must be between -50 and 50 (% of the illustration)").max(50, "must be between -50 and 50 (% of the illustration)").optional(),
  image_offset_y: z.number().min(-50, "must be between -50 and 50 (% of the illustration)").max(50, "must be between -50 and 50 (% of the illustration)").optional(),
};

/** An https link with no spaces (what a help link may point at). Keep in step with 20261024090000_help_link.sql. */
export function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\/\S+$/.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A link to the challenge's source material. Instant mode offers it in the wrong-answer dialog: "Not sure? Refresh
 * your memory in <label>." Display only (not part of content_hash).
 */
export const helpLinkSchema = z.strictObject({
  url: z.string().trim().max(2000, "keep the link under 2000 characters").refine(isHttpsUrl, "must be an https:// link"),
  label: nonEmpty.max(120, "keep the label short (at most 120 characters)"),
});
export type HelpLink = z.infer<typeof helpLinkSchema>;

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
/** Why the right answer is right. Private (stored in challenge_keys): shown once the learner has it right. */
const explanation = z.string().trim().min(1, "must not be empty").max(2000, "keep the explanation short (at most 2000 characters)").optional();

const singleQuestionSchema = z.strictObject({
  id,
  kind: z.literal("single"),
  prompt: nonEmpty,
  options: z.array(optionSchema).min(2, "needs at least 2 options"),
  answer: id,
  explanation,
  points,
});

const multiQuestionSchema = z.strictObject({
  id,
  kind: z.literal("multi"),
  prompt: nonEmpty,
  options: z.array(optionSchema).min(2, "needs at least 2 options"),
  answer: z.array(id).min(1, "needs at least one correct option"),
  explanation,
  points,
});

/** Drag items into the right order. Authors list `items` in the CORRECT order; sync stores them shuffled (see order.ts). */
const orderQuestionSchema = z.strictObject({
  id,
  kind: z.literal("order"),
  prompt: nonEmpty,
  items: z.array(optionSchema).min(2, "needs at least 2 items"),
  explanation,
  points,
});

/**
 * Drag each item onto its category. Authors give every item its `match` (a category id); sync stores the items
 * shuffled without it (the pairs live only in challenge_keys). When every category gets exactly one item, each
 * category holds one item; otherwise a category can take many.
 */
const matchQuestionSchema = z.strictObject({
  id,
  kind: z.literal("match"),
  prompt: nonEmpty,
  categories: z.array(optionSchema).min(2, "needs at least 2 categories"),
  items: z.array(z.strictObject({ id, label: nonEmpty, match: id })).min(2, "needs at least 2 items"),
  explanation,
  points,
});

/** A match question as stored: items shuffled and without their category. */
const publicMatchQuestionSchema = z.strictObject({
  id,
  kind: z.literal("match"),
  prompt: nonEmpty,
  categories: z.array(optionSchema),
  items: z.array(optionSchema),
  /** Every category takes exactly one item (derived from the pairs at sync). */
  one_per_category: z.boolean(),
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
  matchQuestionSchema,
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
  singleQuestionSchema.omit({ answer: true, explanation: true }),
  multiQuestionSchema.omit({ answer: true, explanation: true }),
  orderQuestionSchema.omit({ explanation: true }), // as stored: the items are already shuffled, so this never shows the answer
  publicMatchQuestionSchema,
  textQuestionSchema,
]);

/** final: results after submit. instant: each answer is checked as the learner goes (one real attempt). */
export const feedbackModeSchema = z.enum(["final", "instant"]);
export type FeedbackMode = z.infer<typeof feedbackModeSchema>;

export const challengeFrontmatterSchema = z.strictObject({
  slug,
  title: nonEmpty,
  category: slug,
  audiences: audiencesSchema.optional(), // defaults to the category's audiences
  audience: legacyAudience,
  required_for: audiencesSchema.optional(), // omitted = optional for everyone
  type: challengeTypeSchema,
  feedback_mode: feedbackModeSchema.default("final"), // instant only for auto-graded quizzes (checked in validate.ts)
  // Optional only for `acknowledge` (checked in validate.ts).
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  points: z.number().int().min(0, "must be 0 or more").optional(),
  estimated_minutes: z.number().int().positive().optional(),
  // Part of estimated_minutes spent waiting while Claude Code works (checked in validate.ts: needs estimated_minutes, at most it).
  waiting_minutes: z.number().int().min(0, "must be 0 or more").optional(),
  status: challengeStatusSchema.default("draft"),
  summary: z.string().trim().max(300).optional(),
  image: imageFile.optional(), // overrides the category's image
  ...imageTuning,
  due_at: z.iso.datetime({ offset: true }).optional(),
  tip: z.string().trim().min(1, "must not be empty").max(1000, "keep the tip short (at most 1000 characters)").optional(), // markdown hint above the questions
  help_link: helpLinkSchema.optional(), // source material, offered after a wrong answer in instant mode
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
  image: imageFile.optional(), // card artwork; overrides the category's image
  ...imageTuning,
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
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const AUTO_GRADED_KINDS = ["single", "multi", "order", "match"] as const;

export function isAutoGraded(q: Question | PublicQuestion): boolean {
  return q.kind !== "text";
}

/** The options (single / multi) or items (order / match) of a question; null for a text question. */
export function choicesOf(q: Question | PublicQuestion): { id: string; label: string }[] | null {
  if (q.kind === "text") return null;
  return q.kind === "order" || q.kind === "match" ? q.items : q.options;
}

/** A match answer is a list of "item=category" pairs (ids never contain "="). */
export function matchPair(itemId: string, categoryId: string): string {
  return `${itemId}=${categoryId}`;
}

/** The pairs of a match answer as item id → category id; malformed entries are skipped. */
export function parseMatchPairs(pairs: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of pairs) {
    const [item, category, extra] = p.split("=");
    if (item && category && extra === undefined) out.set(item, category);
  }
  return out;
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
