"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { answerKeySchema, gradeQuiz, publicQuizSchema, quizAnswersSchema, type PublicAcademyQuestion, type QuizResult } from "@/lib/academy/quiz";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const idSchema = z.uuid();

const SIGNED_OUT = { ok: false, error: "Your session has expired. Please sign in again." } as const;
const NOT_FOUND = { ok: false, error: "This resource isn't available any more." } as const;

export type QuizLoadResult = { ok: true; questions: PublicAcademyQuestion[]; done: boolean } | { ok: false; error: string };

/** The quiz of a published resource, without answers, and whether this user has already completed it. */
export async function getAcademyQuiz(resourceId: string): Promise<QuizLoadResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return SIGNED_OUT;
  const id = idSchema.safeParse(resourceId);
  if (!id.success) return NOT_FOUND;

  const admin = createAdminClient();
  const [resource, completion] = await Promise.all([
    admin.from("academy_resources").select("questions").eq("id", id.data).eq("status", "published").maybeSingle(),
    admin.from("academy_completions").select("resource_id").eq("user_id", user.id).eq("resource_id", id.data).maybeSingle(),
  ]);
  if (resource.error || completion.error) return { ok: false, error: "Couldn't load the quiz. Please try again." };
  const questions = publicQuizSchema.safeParse(resource.data?.questions);
  if (!resource.data || !questions.success || questions.data.length === 0) return NOT_FOUND;
  return { ok: true, questions: questions.data, done: !!completion.data };
}

export type QuizSubmitResult = ({ ok: true } & QuizResult) | { ok: false; error: string };

/**
 * Grade one try of a resource's quiz. Decided here with the service role: the key never leaves the server, and the
 * browser gets back only how many were right and which questions were wrong. Every try is recorded; 4 of 5 right
 * completes the resource (once: a completed resource stays completed, and trying again changes nothing).
 */
export async function submitAcademyQuiz(resourceId: string, rawAnswers: unknown): Promise<QuizSubmitResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return SIGNED_OUT;
  const id = idSchema.safeParse(resourceId);
  if (!id.success) return NOT_FOUND;
  const answers = quizAnswersSchema.safeParse(rawAnswers);
  if (!answers.success) return { ok: false, error: "Couldn't read your answers." };

  const admin = createAdminClient();
  const [resource, key] = await Promise.all([
    admin.from("academy_resources").select("questions").eq("id", id.data).eq("status", "published").maybeSingle(),
    admin.from("academy_quiz_keys").select("answer_key").eq("resource_id", id.data).maybeSingle(),
  ]);
  if (resource.error || key.error) return { ok: false, error: "Couldn't check your answers. Please try again." };
  const questions = publicQuizSchema.safeParse(resource.data?.questions);
  const answerKey = answerKeySchema.safeParse(key.data?.answer_key);
  if (!resource.data || !questions.success || !answerKey.success || questions.data.length === 0) return NOT_FOUND;

  const result = gradeQuiz(questions.data, answerKey.data, answers.data);
  const attempt = await admin
    .from("academy_quiz_attempts")
    .insert({ user_id: user.id, resource_id: id.data, correct: result.correct, passed: result.passed });
  if (attempt.error) return { ok: false, error: "Couldn't save your answers. Please try again." };
  if (result.passed) {
    const done = await admin
      .from("academy_completions")
      .upsert({ user_id: user.id, resource_id: id.data }, { onConflict: "user_id,resource_id", ignoreDuplicates: true });
    if (done.error) return { ok: false, error: "You passed, but it couldn't be saved. Please try again." };
    revalidatePath("/academy");
  }
  return { ok: true, ...result };
}

export type DoneResult = { ok: true } | { ok: false; error: string };

/**
 * Switch a resource without a quiz (for now: podcast episodes) to done, or back. Only for published resources with no
 * questions: anything with a quiz is completed by passing it. Switching back removes the user's own completion, never
 * one imported from the old spreadsheet.
 */
export async function setAcademyDone(resourceId: string, done: boolean): Promise<DoneResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return SIGNED_OUT;
  const id = idSchema.safeParse(resourceId);
  if (!id.success || typeof done !== "boolean") return NOT_FOUND;

  const admin = createAdminClient();
  const resource = await admin.from("academy_resources").select("questions").eq("id", id.data).eq("status", "published").maybeSingle();
  if (resource.error) return { ok: false, error: "Couldn't save that. Please try again." };
  if (!resource.data) return NOT_FOUND;
  if (!Array.isArray(resource.data.questions) || resource.data.questions.length > 0) {
    return { ok: false, error: "This one has a quick check: pass it to mark it done." };
  }
  const write = done
    ? await admin.from("academy_completions").upsert({ user_id: user.id, resource_id: id.data }, { onConflict: "user_id,resource_id", ignoreDuplicates: true })
    : await admin.from("academy_completions").delete().eq("user_id", user.id).eq("resource_id", id.data).eq("is_imported", false);
  if (write.error) return { ok: false, error: "Couldn't save that. Please try again." };
  revalidatePath("/academy");
  return { ok: true };
}
