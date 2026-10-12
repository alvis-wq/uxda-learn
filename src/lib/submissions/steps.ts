import { isAutoGraded, type PublicQuestion, type SubmissionSpec } from "@/lib/content/schema";
import { submissionInputSchema, type SubmissionInput } from "@/lib/submissions/input";

/**
 * How a challenge's submission form is split into steps (the React Bits Stepper on the challenge page).
 *  - quiz    every question is auto-graded and there is nothing else to submit: one question per step, then Review.
 *  - mixed   anything with screenshots, a Figma link, a reflection or text questions: Brief → Questions →
 *            Screenshots → Figma link → Reflection → Review & submit, only the steps that apply.
 *  - single  one thing to fill in (one question, or one field): the plain form, no stepper.
 */
export type StepKind = "brief" | "question" | "questions" | "screenshots" | "figma" | "reflection" | "review";
export type StepDef = { id: string; kind: StepKind; title: string; questionId?: string };
export type StepPlan = { mode: "single" | "quiz" | "mixed"; steps: StepDef[] };

type Plannable = { questions: PublicQuestion[]; submission_spec: SubmissionSpec };

export function planSteps({ questions, submission_spec: spec }: Plannable): StepPlan {
  const hasSpec = Boolean(spec.screenshots || spec.figma_url || spec.reflection);
  const review: StepDef = { id: "review", kind: "review", title: "Review & submit" };

  if (!hasSpec && questions.length > 0 && questions.every(isAutoGraded)) {
    if (questions.length < 2) return { mode: "single", steps: [] };
    return {
      mode: "quiz",
      steps: [
        ...questions.map<StepDef>((q, i) => ({
          id: `q:${q.id}`,
          kind: "question",
          title: `Question ${i + 1}`,
          questionId: q.id,
        })),
        { ...review, title: "Review" },
      ],
    };
  }

  const inputs: StepDef[] = [];
  if (questions.length > 0) inputs.push({ id: "questions", kind: "questions", title: "Questions" });
  if (spec.screenshots) inputs.push({ id: "screenshots", kind: "screenshots", title: "Screenshots" });
  if (spec.figma_url) inputs.push({ id: "figma", kind: "figma", title: "Figma link" });
  if (spec.reflection) inputs.push({ id: "reflection", kind: "reflection", title: "Reflection" });
  if (inputs.length < 2) return { mode: "single", steps: [] };
  return { mode: "mixed", steps: [{ id: "brief", kind: "brief", title: "Brief" }, ...inputs, review] };
}

/** Everything the learner has entered. Held in one object above the Stepper, which unmounts non-current steps. */
export type FormValues = {
  answers: Record<string, string | string[]>;
  images: { path: string }[];
  figmaUrl: string;
  reflection: string;
  /** A screenshot upload is still in flight. */
  uploading: boolean;
};

export const emptyValues: FormValues = { answers: {}, images: [], figmaUrl: "", reflection: "", uploading: false };

export function toSubmission(v: FormValues): SubmissionInput {
  return {
    answers: v.answers,
    imagePaths: v.images.map((i) => i.path),
    figmaUrl: v.figmaUrl || null,
    reflection: v.reflection || null,
  };
}

/** Why a step can't be continued from yet, by step id. A step that is fine has no entry. */
export type StepProblems = Record<string, string>;

/**
 * Checks the values against the same Zod schema the server action uses (so the two can't drift), and
 * attributes each issue to the step that owns the field.
 */
export function stepProblems(
  plan: StepPlan,
  challenge: Plannable & { slug: string },
  userId: string,
  values: FormValues,
): StepProblems {
  const parsed = submissionInputSchema(challenge, userId).safeParse(toSubmission(values));
  const problems: StepProblems = {};
  const questionIssues: { questionId: string; message: string }[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [head, key] = issue.path;
      if (head === "answers" && typeof key === "string") {
        if (plan.mode === "quiz") problems[`q:${key}`] ??= issue.message;
        else questionIssues.push({ questionId: key, message: issue.message });
      } else if (head === "imagePaths") problems.screenshots ??= issue.message;
      else if (head === "figmaUrl") problems.figma ??= issue.message;
      else if (head === "reflection") problems.reflection ??= issue.message;
      else problems.review ??= issue.message;
    }
  }

  if (questionIssues.length > 0) {
    const first = questionIssues[0];
    const number = challenge.questions.findIndex((q) => q.id === first.questionId) + 1;
    const more = questionIssues.length - 1;
    problems.questions = `Question ${number}: ${first.message}${more > 0 ? ` (${more} more to go)` : ""}`;
  }
  if (values.uploading) problems.screenshots = "Waiting for your screenshots to finish uploading.";
  return problems;
}

/** The furthest 1-based step reachable: you can't skip past a step that isn't valid yet. */
export function furthestStep(plan: StepPlan, problems: StepProblems): number {
  const firstBad = plan.steps.findIndex((s) => s.kind !== "review" && problems[s.id]);
  return firstBad === -1 ? plan.steps.length : firstBad + 1;
}

export function clampStep(plan: StepPlan, problems: StepProblems, target: number): number {
  return Math.max(1, Math.min(target, furthestStep(plan, problems), plan.steps.length));
}

/** True when every step (so the whole submission) is valid and ready to send. */
export function isComplete(plan: StepPlan, problems: StepProblems): boolean {
  return plan.steps.every((s) => !problems[s.id]);
}

/** Which step a server-side field error (`answers.q1`, `imagePaths`, …) belongs to. */
export function stepForField(plan: StepPlan, field: string): string {
  const [head, key] = field.split(".");
  if (head === "answers") return plan.mode === "quiz" ? `q:${key}` : "questions";
  if (head === "imagePaths") return "screenshots";
  if (head === "figmaUrl") return "figma";
  if (head === "reflection") return "reflection";
  return "review";
}
