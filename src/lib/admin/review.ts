import { z } from "zod";

export const REVIEWABLE_STATUSES = ["submitted", "ai_reviewed"] as const;

/** Admin review decision. Score is validated against the submission's max_score by the caller. */
export const reviewSchema = z
  .object({
    submissionId: z.uuid(),
    decision: z.enum(["approve", "resubmit"]),
    finalScore: z.coerce.number().min(0, "Score can't be negative.").multipleOf(0.5, "Use whole or half points."),
    feedback: z.string().trim().max(5000, "Feedback is too long."),
  })
  .refine((v) => v.decision === "approve" || v.feedback.length > 0, {
    path: ["feedback"],
    message: "Tell them what to change.",
  });

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
