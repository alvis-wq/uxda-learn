"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IMPORT_STATUS, importInputSchema } from "@/lib/admin/path-import";
import { getAdminOrNull } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../../actions";

const NOT_ADMIN: ActionResult = { ok: false, error: "Only admins can do this." };

/** Messages raised by import_submission() / undo_import() that are safe and useful to show as they are. */
function dbMessage(error: { code?: string; message: string }): string {
  return error.code === "22023" || error.code === "P0002" ? `${error.message[0].toUpperCase()}${error.message.slice(1)}.` : "Couldn't save. Please try again.";
}

/**
 * Admin → Users → a user → Path progress: record a milestone done (published, counts at once) or changes requested,
 * with a score and a note, as the user's next real attempt flagged imported. import_submission() checks the actor is
 * an admin, the path is published, the user's track can see it and the attempt rules, and writes the audit row.
 */
export async function importMilestone(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;

  const parsed = importInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "form"] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { userId, slug, outcome, score, feedback } = parsed.data;

  const { error } = await createAdminClient().rpc("import_submission", {
    p_user: userId,
    p_challenge: slug,
    p_status: IMPORT_STATUS[outcome],
    p_score: score,
    p_feedback: feedback,
    p_source: "admin",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: dbMessage(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove an imported attempt (only the user's latest on that milestone). Audited by undo_import(). */
export async function undoImport(submissionId: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ADMIN;
  const id = z.uuid().safeParse(submissionId);
  if (!id.success) return { ok: false, error: "Submission not found." };

  const { error } = await createAdminClient().rpc("undo_import", { p_submission: id.data, p_source: "admin", p_actor: admin.id });
  if (error) return { ok: false, error: dbMessage(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}
