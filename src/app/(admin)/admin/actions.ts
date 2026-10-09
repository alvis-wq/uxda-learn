"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminOrNull } from "@/lib/auth/admin";
import { REVIEWABLE_STATUSES, reviewSchema } from "@/lib/admin/review";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const NOT_ADMIN: ActionResult = { ok: false, error: "Only admins can do this." };

/** Approve (→ published) or request resubmission for a submission awaiting review. */
export async function reviewSubmission(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;

  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "form"] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { submissionId, decision, finalScore, feedback } = parsed.data;

  const db = createAdminClient();
  const { data: sub } = await db.from("submissions").select("id,status,max_score").eq("id", submissionId).maybeSingle();
  if (!sub) return { ok: false, error: "Submission not found." };
  if (!REVIEWABLE_STATUSES.includes(sub.status as (typeof REVIEWABLE_STATUSES)[number])) {
    return { ok: false, error: "This submission has already been reviewed." };
  }
  if (finalScore > Number(sub.max_score)) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { finalScore: `Max is ${sub.max_score}.` } };
  }

  const now = new Date().toISOString();
  // The status condition makes this a compare-and-set: two admins can't both act on it.
  const { data: updated, error } = await db
    .from("submissions")
    .update(
      decision === "approve"
        ? { status: "published", final_score: finalScore, feedback: feedback || null, published_at: now }
        : { status: "needs_resubmission", final_score: finalScore, feedback, published_at: null },
    )
    .eq("id", submissionId)
    .in("status", [...REVIEWABLE_STATUSES])
    .select("id");
  if (error) return { ok: false, error: "Couldn't save the review. Please try again." };
  if (!updated?.length) return { ok: false, error: "This submission has already been reviewed." };

  // Record who signed off on the AI evaluation(s).
  await db
    .from("evaluations")
    .update({ approved_by: admin.id, approved_at: now })
    .eq("submission_id", submissionId)
    .is("approved_at", null);

  revalidatePath("/", "layout");
  return { ok: true };
}

const userIdSchema = z.uuid();

export async function setUserTrack(userId: string, track: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const t = z.enum(["strategist", "designer"]).safeParse(track);
  if (!id.success || !t.success) return { ok: false, error: "Invalid input." };

  const { data, error } = await createAdminClient().from("profiles").update({ track: t.data }).eq("id", id.data).select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't update the track." };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const flag = z.boolean().safeParse(isAdmin);
  if (!id.success || !flag.success) return { ok: false, error: "Invalid input." };
  if (id.data === admin.id && !flag.data) {
    return { ok: false, error: "You can't remove your own admin access." };
  }

  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ is_admin: flag.data })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't update admin access." };
  revalidatePath("/admin/users");
  return { ok: true };
}
