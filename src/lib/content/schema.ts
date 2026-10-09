import { z } from "zod";

/** Zod schemas for /content. Spec: docs/content-format.md. */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (a-z, 0-9, hyphens)");
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i, "must be a simple id (letters, digits, - or _)");
const nonEmpty = z.string().trim().min(1, "must not be empty");

export const audienceSchema = z.enum(["all", "strategist", "designer"]);
export const challengeTypeSchema = z.enum(["quiz", "screenshot", "figma", "mixed"]);
export const challengeStatusSchema = z.enum(["draft", "published", "archived"]);

export const categorySchema = z.strictObject({
  slug,
  title: nonEmpty,
  audience: audienceSchema,
  description: z.string().trim().optional(),
  sort_order: z.number().int().default(0),
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

export const challengeFrontmatterSchema = z.strictObject({
  slug,
  title: nonEmpty,
  category: slug,
  audience: audienceSchema.optional(),
  type: challengeTypeSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  points,
  estimated_minutes: z.number().int().positive().optional(),
  status: challengeStatusSchema.default("draft"),
  summary: z.string().trim().max(300).optional(),
  due_at: z.iso.datetime({ offset: true }).optional(),
  questions: z.array(questionSchema).default([]),
  submission: submissionSpecSchema.optional(),
  rubric: z.array(rubricCriterionSchema).default([]),
  grader_notes: z.string().optional(),
});

export type Category = z.infer<typeof categorySchema>;
export type Question = z.infer<typeof questionSchema>;
export type SubmissionSpec = z.infer<typeof submissionSpecSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type ChallengeFrontmatter = z.infer<typeof challengeFrontmatterSchema>;

/** A question as shown to users: never includes the answer. */
export type PublicQuestion =
  | Omit<Extract<Question, { kind: "single" }>, "answer">
  | Omit<Extract<Question, { kind: "multi" }>, "answer">
  | Extract<Question, { kind: "text" }>;

export const AUTO_GRADED_KINDS = ["single", "multi"] as const;

export function isAutoGraded(q: Question | PublicQuestion): boolean {
  return q.kind === "single" || q.kind === "multi";
}

/** True when a submission needs human/AI review (anything beyond auto-graded questions). */
export function needsReview(c: Pick<ChallengeFrontmatter, "questions" | "submission">): boolean {
  const s = c.submission;
  return (
    c.questions.some((q) => !isAutoGraded(q)) ||
    Boolean(s && (s.screenshots || s.figma_url || s.reflection))
  );
}
