"use server";

import { revalidatePath } from "next/cache";
import {
  featuredMoveSchema,
  pathPublishError,
  pathSettingChangeError,
  pathSettingChangeSchema,
  pathStatusChangeSchema,
  settingChangeError,
  settingChangeSchema,
} from "@/lib/admin/challenge-settings";
import { getAdminOrNull } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../actions";

/**
 * Change one admin-owned setting (status, required_for, due_at, featured_for) of a challenge and record it in
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
    .select("slug,title,summary,body_md,tip,help_link,audiences,questions,submission_spec,rubric,category_slug,path_slug")
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

/**
 * Change a learning path's status, audited in path_settings_audit. Publishing also publishes every draft milestone
 * of the path, in the same transaction (each change in that challenge's own history), after checking that neither
 * the path nor those milestones still have placeholders.
 */
export async function updatePathStatus(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Only admins can do this." };

  const parsed = pathStatusChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid value." };
  const { slug, value } = parsed.data;

  const db = createAdminClient();
  const { data: path } = await db.from("paths").select("slug,title,summary,before_you_start,before_you_submit,milestones").eq("slug", slug).maybeSingle();
  if (!path) return { ok: false, error: "Path not found." };

  if (value === "published") {
    const [{ data: rows }, { data: keys }] = await Promise.all([
      db
        .from("challenges")
        .select("slug,title,summary,body_md,tip,help_link,audiences,questions,submission_spec,rubric,status")
        .in("slug", path.milestones),
      db.from("challenge_keys").select("challenge_slug,grader_notes").in("challenge_slug", path.milestones),
    ]);
    const notes = new Map((keys ?? []).map((k) => [k.challenge_slug, k.grader_notes]));
    const problem = pathPublishError(
      path,
      (rows ?? []).map((c) => ({ challenge: c, category: null, graderNotes: notes.get(c.slug) ?? null, status: c.status })),
    );
    if (problem) return { ok: false, error: problem };
  }

  const { error } = await db.rpc("set_path_status", {
    p_slug: slug,
    p_value: value,
    p_source: "admin",
    p_actor: admin.id,
    p_publish_milestones: value === "published",
  });
  if (error) return { ok: false, error: "Couldn't save the change. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change a learning path's required_for, due_at or featured_for, audited in path_settings_audit (set_path_setting).
 * Admin-owned like its status: content:sync never writes them after the path is created (featured_for never at all).
 */
export async function updatePathSetting(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Only admins can do this." };

  const parsed = pathSettingChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid value." };
  const change = parsed.data;

  const db = createAdminClient();
  const { data: path } = await db.from("paths").select("slug,audiences,category_slug").eq("slug", change.slug).maybeSingle();
  if (!path) return { ok: false, error: "Path not found." };
  const { data: category } = await db.from("categories").select("audiences").eq("slug", path.category_slug).maybeSingle();

  const problem = pathSettingChangeError(change, path, category);
  if (problem) return { ok: false, error: problem };

  const { error } = await db.rpc("set_path_setting", {
    p_slug: change.slug,
    p_field: change.field,
    p_value: change.value,
    p_source: "admin",
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: "Couldn't save the change. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Move a featured challenge or path one place up or down in the home page's "Featured" order. move_featured swaps it
 * with its neighbour and records both moves in their audit logs; at either end nothing changes.
 */
export async function moveFeatured(raw: unknown): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "Only admins can do this." };

  const parsed = featuredMoveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid value." };
  const { kind, slug, direction } = parsed.data;

  const { error } = await createAdminClient().rpc("move_featured", {
    p_kind: kind,
    p_slug: slug,
    p_direction: direction,
    p_actor: admin.id,
  });
  if (error) {
    return { ok: false, error: error.code === "P0002" ? "That isn't featured any more. Reload the page." : "Couldn't move it. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
