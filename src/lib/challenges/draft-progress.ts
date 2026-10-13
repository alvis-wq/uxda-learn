import { z } from "zod";
import { publicQuestionSchema, submissionSpecSchema } from "@/lib/content/schema";
import { planSteps } from "@/lib/submissions/steps";

/** How far along a saved draft is, in the Stepper's own terms ("Step 2 of 5"). */
export type DraftProgress = { step: number; total: number };

/**
 * Where a saved draft stands: the step it was saved on, out of the steps the challenge's Stepper has now (the same
 * count the Stepper shows). Null for a challenge without a Stepper (single-step: one question or one field), which has
 * no steps to count. A step beyond the current plan (the challenge shrank since) is held at the last one.
 */
export function draftProgress(
  challenge: { questions: unknown; submission_spec: unknown },
  currentStep: number,
): DraftProgress | null {
  const questions = z.array(publicQuestionSchema).safeParse(challenge.questions ?? []);
  const spec = submissionSpecSchema.safeParse(challenge.submission_spec ?? {});
  if (!questions.success || !spec.success) return null;
  const { steps } = planSteps({ questions: questions.data, submission_spec: spec.data });
  if (steps.length === 0) return null;
  const step = Number.isInteger(currentStep) ? currentStep : 1;
  return { step: Math.min(Math.max(step, 1), steps.length), total: steps.length };
}
