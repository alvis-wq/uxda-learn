import { z } from "zod";
import type { PublicQuestion } from "@/lib/content/schema";
import { gradeAnswers, type AnswerKey, type Answers } from "@/lib/submissions/grading";

/**
 * An Academy quiz: exactly 5 single-choice questions with 4 options each. Pass = 4 of 5 right.
 *
 * Editors (and Claude, when it drafts one) work with the simple `QuizDraft` shape: prompt, four option texts and the
 * index of the right one. It is stored split, like challenges: `academy_resources.questions` holds public `single`
 * questions (ids q1…q5, options a…d, no answer) and `academy_quiz_keys.answer_key` holds { q1: "c", … }.
 */
export const QUIZ_LENGTH = 5;
export const OPTION_COUNT = 4;
export const PASS_MARK = 4;

const OPTION_IDS = ["a", "b", "c", "d"] as const;

const text = (max: number) => z.string().trim().min(1, "must not be empty").max(max, `keep it under ${max} characters`);

export const quizQuestionDraftSchema = z.strictObject({
  prompt: text(300),
  options: z.array(text(200)).length(OPTION_COUNT, `needs exactly ${OPTION_COUNT} options`),
  answer: z.number().int().min(0).max(OPTION_COUNT - 1),
});

export const quizDraftSchema = z
  .array(quizQuestionDraftSchema)
  .length(QUIZ_LENGTH, `needs exactly ${QUIZ_LENGTH} questions`)
  .refine(
    (qs) => qs.every((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length),
    "a question has the same option twice",
  );

export type QuizQuestionDraft = z.infer<typeof quizQuestionDraftSchema>;
export type QuizDraft = z.infer<typeof quizDraftSchema>;

/** A stored public question (what academy_resources.questions holds). */
const publicAcademyQuestionSchema = z.strictObject({
  id: z.string(),
  kind: z.literal("single"),
  prompt: z.string(),
  options: z.array(z.strictObject({ id: z.string(), label: z.string() })),
  points: z.literal(1),
});
export const publicQuizSchema = z.array(publicAcademyQuestionSchema);
export type PublicAcademyQuestion = z.infer<typeof publicAcademyQuestionSchema>;

export const answerKeySchema = z.record(z.string(), z.string());

/** Fisher–Yates on a copy. `random` is injectable for tests. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Split a draft into what everyone may see and the private key. The options of each question are shuffled (drafts
 * tend to put the right answer first), so the stored order says nothing about the answer.
 */
export function splitQuiz(draft: QuizDraft, random: () => number = Math.random) {
  const questions: PublicAcademyQuestion[] = [];
  const answerKey: Record<string, string> = {};
  draft.forEach((q, i) => {
    const id = `q${i + 1}`;
    const order = shuffle(
      q.options.map((label, index) => ({ label, index })),
      random,
    );
    questions.push({
      id,
      kind: "single",
      prompt: q.prompt,
      options: order.map((o, k) => ({ id: OPTION_IDS[k], label: o.label })),
      points: 1,
    });
    answerKey[id] = OPTION_IDS[order.findIndex((o) => o.index === q.answer)];
  });
  return { questions, answerKey };
}

/** Put a stored quiz back together for editing. Null when the two halves don't fit (e.g. no quiz yet). */
export function joinQuiz(questions: unknown, answerKey: unknown): QuizDraft | null {
  const qs = publicQuizSchema.safeParse(questions);
  const key = answerKeySchema.safeParse(answerKey);
  if (!qs.success || !key.success || qs.data.length !== QUIZ_LENGTH) return null;
  const draft = qs.data.map((q) => ({
    prompt: q.prompt,
    options: q.options.map((o) => o.label),
    answer: q.options.findIndex((o) => o.id === key.data[q.id]),
  }));
  const parsed = quizDraftSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/** Answers are { q1: "a", … }: one option id per question. */
export const quizAnswersSchema = z.record(z.string().max(10), z.string().max(10));

export type QuizResult = { correct: number; total: number; passed: boolean; wrong: string[] };

/** Grade a try with the shared grader. Unanswered questions count as wrong. */
export function gradeQuiz(questions: PublicAcademyQuestion[], key: AnswerKey, answers: Answers): QuizResult {
  const { results } = gradeAnswers(questions as PublicQuestion[], key, answers);
  const correct = results.filter((r) => r.correct).length;
  return { correct, total: results.length, passed: correct >= PASS_MARK, wrong: results.filter((r) => !r.correct).map((r) => r.id) };
}
