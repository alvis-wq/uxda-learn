"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminOrNull } from "@/lib/auth/admin";
import { REVIEWABLE_STATUSES, reviewSchema } from "@/lib/admin/review";
import { jobTitleSchema, staffEmailSchema } from "@/lib/staff-titles";
import { createAdminClient } from "@/lib/supabase/admin";
import { SELECTABLE_TRACK_VALUES } from "@/lib/tracks";

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

/**
 * Put a user on one of the selectable tracks. Goes through set_user_track(), which updates the profile and writes
 * the staff_audit row (who, when, old -> new) in one transaction; the SQL function refuses a non-admin actor too.
 */
export async function setUserTrack(userId: string, track: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const t = z.enum(SELECTABLE_TRACK_VALUES).safeParse(track);
  if (!id.success || !t.success) return { ok: false, error: "Invalid input." };

  const { error } = await createAdminClient().rpc("set_user_track", { p_user: id.data, p_track: t.data, p_actor: admin.id });
  if (error) return { ok: false, error: "Couldn't update the track." };
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Turn the tester switch on or off for any user (any track). Goes through set_user_tester(), which updates the
 * profile and writes the audit row (who, when, old -> new) in one transaction; the SQL function itself refuses a
 * non-admin actor, on top of the check here.
 */
export async function setUserTester(userId: string, isTester: boolean): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const flag = z.boolean().safeParse(isTester);
  if (!id.success || !flag.success) return { ok: false, error: "Invalid input." };

  const { error } = await createAdminClient().rpc("set_user_tester", { p_user: id.data, p_value: flag.data, p_actor: admin.id });
  if (error) return { ok: false, error: "Couldn't update tester access." };
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Turn the lead switch on or off: a lead sees the Team page (everyone's status and best score per challenge). Goes
 * through set_user_lead(), which updates the profile and writes the audit row in one transaction; the SQL function
 * refuses a non-admin actor too.
 */
export async function setUserLead(userId: string, isLead: boolean): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const flag = z.boolean().safeParse(isLead);
  if (!id.success || !flag.success) return { ok: false, error: "Invalid input." };

  const { error } = await createAdminClient().rpc("set_user_lead", { p_user: id.data, p_value: flag.data, p_actor: admin.id });
  if (error) return { ok: false, error: "Couldn't update lead access." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Turn the Academy editor switch on or off: an editor adds and edits Academy blog posts, podcasts, books and their
 * quizzes. Goes through set_user_academy_editor() (updates the profile and writes the audit row in one transaction; it
 * refuses a non-admin actor too).
 */
export async function setUserAcademyEditor(userId: string, isEditor: boolean): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = userIdSchema.safeParse(userId);
  const flag = z.boolean().safeParse(isEditor);
  if (!id.success || !flag.success) return { ok: false, error: "Invalid input." };

  const { error } = await createAdminClient().rpc("set_user_academy_editor", {
    p_user: id.data,
    p_value: flag.data,
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: "Couldn't update Academy editor access." };
  revalidatePath("/", "layout");
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

/**
 * Set a job title (empty = remove it). Goes through set_staff_title(), which writes the title and its staff_audit row
 * in one transaction; the SQL function refuses a non-admin actor too.
 */
export async function setStaffTitle(email: string, title: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const e = staffEmailSchema.safeParse(email);
  if (!e.success) return { ok: false, error: "Invalid input." };
  const t = jobTitleSchema.safeParse(title);
  if (!t.success) return { ok: false, error: t.error.issues[0]?.message ?? "Invalid title." };

  const { error } = await createAdminClient().rpc("set_staff_title", {
    p_email: e.data,
    p_title: t.data,
    p_source: "admin",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: "Couldn't save the title." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Fix the email of a seeded title nobody has signed in with yet, then save its title (both audited). The SQL refuses
 * an email someone has signed in with, and a new email that already has a title.
 */
export async function updatePendingStaff(oldEmail: string, newEmail: string, title: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const from = staffEmailSchema.safeParse(oldEmail);
  if (!from.success) return { ok: false, error: "Invalid input." };
  const to = staffEmailSchema.safeParse(newEmail);
  if (!to.success) return { ok: false, error: "Enter a valid email." };
  const t = jobTitleSchema.min(1, "Enter a title, or remove the row.").safeParse(title);
  if (!t.success) return { ok: false, error: t.error.issues[0]?.message ?? "Invalid title." };

  const db = createAdminClient();
  if (to.data !== from.data) {
    const { error } = await db.rpc("rename_staff_email", { p_old: from.data, p_new: to.data, p_actor: admin.id });
    if (error) {
      return {
        ok: false,
        error:
          error.code === "23505"
            ? `${to.data} already has a title.`
            : error.code === "42501"
              ? `Someone has signed in with ${from.data}, so it can't be changed here.`
              : "Couldn't change the email.",
      };
    }
  }
  const { error } = await db.rpc("set_staff_title", {
    p_email: to.data,
    p_title: t.data,
    p_source: "admin",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: "The email was saved, but the title wasn't. Please try again." };
  revalidatePath("/admin/users");
  return { ok: true };
}
