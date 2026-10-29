import { z } from "zod";

export const REVIEWABLE_STATUSES = ["submitted", "ai_reviewed"] as const;

/** Whole or half points, not negative. The max is the submission's max_score, checked by the caller. */
const scoreSchema = z.coerce.number().min(0, "Score can't be negative.").multipleOf(0.5, "Use whole or half points.");
const feedbackSchema = z.string().trim().max(5000, "Feedback is too long.");

/**
 * Admin review decision. Score is validated against the submission's max_score by the caller. `editedAt` is the
 * learner's last edit as the admin saw it (null: never edited): a decision on content that has changed since is refused.
 */
export const reviewSchema = z
  .object({
    submissionId: z.uuid(),
    decision: z.enum(["approve", "resubmit"]),
    finalScore: scoreSchema,
    feedback: feedbackSchema,
    editedAt: z.string().max(64).nullable().default(null),
  })
  .refine((v) => v.decision === "approve" || v.feedback.length > 0, {
    path: ["feedback"],
    message: "Tell them what to change.",
  });

/** Approve several AI-reviewed submissions at once, each with the score and feedback the AI review set. */
export const bulkApproveSchema = z.array(z.uuid()).min(1, "Select at least one.").max(200, "Approve at most 200 at once.");

/** Change the score and feedback of a reviewed submission (published or needs resubmission). */
export const adjustReviewSchema = z.object({
  submissionId: z.uuid(),
  finalScore: scoreSchema,
  feedback: feedbackSchema,
});

export const ADJUSTABLE_STATUSES = ["published", "needs_resubmission"] as const;

export type QueueItem = {
  status: string;
  submitted_at: string;
  confidence: string | null;
};

/** ai_reviewed first, low confidence first within that, then oldest first. */
export function sortQueue<T extends QueueItem>(items: T[]): T[] {
  const conf = (c: string | null) => (c === "low" ? 0 : c === "medium" ? 1 : c === "high" ? 2 : 3);
  return [...items].sort(
    (a, b) =>
      Number(b.status === "ai_reviewed") - Number(a.status === "ai_reviewed") ||
      conf(a.confidence) - conf(b.confidence) ||
      a.submitted_at.localeCompare(b.submitted_at),
  );
}
