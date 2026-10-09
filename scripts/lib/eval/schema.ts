import { z } from "zod";

/** Shapes shared by eval:pull (writes the manifest) and eval:push (reads results.json). */

export const BATCH_ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;
export const batchIdSchema = z.string().regex(BATCH_ID_RE, "batch id must look like 20261009-101500-ab12");

export const EVAL_FLAGS = [
  "figma_inaccessible",
  "unreadable_image",
  "off_brief",
  "possible_duplicate",
  "injection_attempt",
] as const;

export const reviewItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["rubric", "text_question"]),
  label: z.string(),
  max: z.number(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const manifestSubmissionSchema = z.object({
  submission_id: z.uuid(),
  attempt: z.number(),
  submitted_at: z.string(),
  user: z.object({ name: z.string().nullable(), email: z.string(), track: z.string().nullable() }),
  challenge: z.object({
    slug: z.string(),
    title: z.string(),
    version: z.number(),
    type: z.string(),
    points: z.number(),
    brief_md: z.string(),
    questions: z.array(z.unknown()),
    submission_spec: z.unknown(),
    rubric: z.array(z.unknown()),
    grader_notes: z.string().nullable(),
  }),
  submitted_against_version: z.number(),
  review_items: z.array(reviewItemSchema),
  answers: z.record(z.string(), z.unknown()),
  auto_score: z.number(),
  max_score: z.number(),
  figma_url: z.string().nullable(),
  reflection: z.string().nullable(),
  images: z.array(
    z.object({ storage_path: z.string(), local_path: z.string().nullable(), error: z.string().optional() }),
  ),
});
export type ManifestSubmission = z.infer<typeof manifestSubmissionSchema>;

export const manifestSchema = z.object({
  batch_id: batchIdSchema,
  created_at: z.string(),
  notice: z.string(),
  submissions: z.array(manifestSubmissionSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** results.json — shape documented in .claude/commands/evaluate.md. */
export const resultsSchema = z.strictObject({
  batch_id: batchIdSchema,
  model: z.string().trim().min(1, "model is required"),
  results: z.array(
    z.strictObject({
      submission_id: z.uuid(),
      criteria: z
        .array(
          z.strictObject({
            id: z.string().min(1),
            score: z.number().min(0).multipleOf(0.5, "scores use whole or half points"),
            max: z.number().positive(),
            evidence: z.string().trim().min(1, "every score must cite evidence"),
            comment: z.string().optional(),
          }),
        )
        .min(1),
      total: z.number().min(0),
      feedback: z.string().trim().min(1, "feedback is required").max(5000),
      confidence: z.enum(["high", "medium", "low"]),
      flags: z.array(z.enum(EVAL_FLAGS)).default([]),
    }),
  ),
});
export type Results = z.infer<typeof resultsSchema>;
