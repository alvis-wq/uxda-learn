"use server";

import { revalidatePath } from "next/cache";
import { settingChangeError, settingChangeSchema } from "@/lib/admin/challenge-settings";
import { getAdminOrNull } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../actions";

/**
 * Change one admin-owned setting (status, required_for, due_at) of a challenge and record it in
 * the audit log. The write + audit row happen together in set_challenge_setting().
 */
export async function updateChallengeSetting(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Only admins can do this." };

  const parsed = settingChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid value." };
  const change = parsed.data;

  const db = createAdminClient();
  const { data: challenge } = await db
    .from("challenges")
    .select("slug,title,summary,body_md,audiences,questions,submission_spec,rubric,category_slug")
    .eq("slug", change.slug)
    .maybeSingle();
  if (!challenge) return { ok: false, error: "Challenge not found." };
  const [{ data: category }, { data: key }] = await Promise.all([
    db.from("categories").select("audiences").eq("slug", challenge.category_slug).maybeSingle(),
    db.from("challenge_keys").select("grader_notes").eq("challenge_slug", change.slug).maybeSingle(),
  ]);

  const problem = settingChangeError(change, { challenge, category, graderNotes: key?.grader_notes ?? null });
  if (problem) return { ok: false, error: problem };

  const { error } = await db.rpc("set_challenge_setting", {
    p_slug: change.slug,
    p_field: change.field,
    p_value: change.value,
    p_source: "admin",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: "Couldn't save the change. Please try again." };

  // Status / required / due affect learner pages, home and admin progress alike.
  revalidatePath("/", "layout");
  return { ok: true };
}
