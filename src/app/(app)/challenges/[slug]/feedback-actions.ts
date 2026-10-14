"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { FEEDBACK_MAX } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FeedbackResult = { ok: true } | { ok: false; error: string };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
const bodySchema = z
  .string({ error: "Write your feedback first." })
  .trim()
  .min(1, "Write your feedback first.")
  .max(FEEDBACK_MAX, `Keep it under ${FEEDBACK_MAX} characters.`);

/**
 * A tester's note on a draft challenge, for the admin. Written with the service role after checking, with the user's
 * own session, that the challenge really is a draft they may see (RLS decides that: a non-tester gets no row back).
 */
export async function submitFeedback(slugInput: string, bodyInput: unknown): Promise<FeedbackResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.is_tester) return { ok: false, error: "Feedback is only for testers." };

  const slug = slugSchema.safeParse(slugInput);
  if (!slug.success) return { ok: false, error: "Challenge not found." };
  const body = bodySchema.safeParse(bodyInput);
  if (!body.success) return { ok: false, error: body.error.issues[0]?.message ?? "Write your feedback first." };

  const supabase = await createClient();
  const { data: challenge } = await supabase.from("challenges").select("slug,status").eq("slug", slug.data).maybeSingle();
  if (!challenge || challenge.status !== "draft") return { ok: false, error: "You can only send feedback on a draft you can test." };

  const { error } = await createAdminClient()
    .from("challenge_feedback")
    .insert({ challenge_slug: challenge.slug, user_id: user.id, body: body.data });
  if (error) return { ok: false, error: "Couldn't send your feedback. Please try again." };

  revalidatePath(`/admin/content/${challenge.slug}`);
  return { ok: true };
}
