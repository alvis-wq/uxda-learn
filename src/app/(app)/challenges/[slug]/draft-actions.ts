"use server";

import { z } from "zod";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { parseChallenge } from "@/lib/challenges/model";
import { loadOpenChallenge, milestoneGate } from "@/lib/challenges/open";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isBlankDraft } from "@/lib/submissions/draft";
import { draftInputSchema } from "@/lib/submissions/input";
import { attemptState, maxAttemptsFor } from "@/lib/submissions/rules";
import { isTestChallenge, testingState } from "@/lib/submissions/testing";
import { planSteps } from "@/lib/submissions/steps";

export type SaveDraftResult =
  | { ok: true; savedAt: string }
  /** `stale`: the challenge changed since the page loaded, so saving would write answers to the wrong questions. */
  | { ok: false; error: string; stale?: boolean };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);

/**
 * Save the signed-in learner's in-progress form. Visibility and attempts are checked with the service role (as for
 * a submission) but the write itself uses the learner's own session, so RLS (own rows only) is the hard stop. What
 * is saved is validated with draftInputSchema: partial answers are fine, anything that doesn't belong is not.
 * A form with nothing in it removes the draft instead of storing an empty one.
 */
export async function saveDraft(slugInput: string, rawInput: unknown): Promise<SaveDraftResult> {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  if (!user || !profile) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!profile.track) return { ok: false, error: "Choose your track first." };

  const slug = slugSchema.safeParse(slugInput);
  if (!slug.success) return { ok: false, error: "Challenge not found." };

  const admin = createAdminClient();
  const row = await loadOpenChallenge(admin, slug.data, profile.track, profile.is_tester);
  if (!row || row.type === "acknowledge") return { ok: false, error: "This challenge isn't open for submissions." };
  const locked = await milestoneGate(admin, row, { id: user.id, track: profile.track, is_tester: profile.is_tester });
  if (locked) return { ok: false, error: locked };
  const challenge = parseChallenge(row);
  // An instant-feedback run is saved by checkInstantAnswer as each answer is checked; there is nothing else to keep.
  if (challenge.feedback_mode === "instant") return { ok: false, error: "This quiz saves your progress as you go." };

  const sent = (rawInput as { version?: unknown } | null)?.version;
  if (sent !== challenge.version) {
    return { ok: false, stale: true, error: "This challenge was updated. Reload the page to continue." };
  }

  const { data: previous, error: prevError } = await admin
    .from("submissions")
    .select("attempt,status,final_score,max_score")
    .eq("user_id", user.id)
    .eq("challenge_slug", challenge.slug)
    .eq("is_test", isTestChallenge(row.status));
  if (prevError) return { ok: false, error: "Couldn't save your progress." };
  const state = isTestChallenge(row.status) ? testingState(previous) : attemptState(previous, maxAttemptsFor(challenge.feedback_mode));
  if (!state.canSubmit) return { ok: false, error: state.reason ?? "You can't submit right now." };

  const plan = planSteps(challenge);
  const parsed = draftInputSchema(challenge, user.id, plan.steps.length).safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Couldn't save your progress." };
  const input = parsed.data;
  const draft = {
    answers: Object.fromEntries(Object.entries(input.answers).filter(([, v]) => v !== undefined)) as Record<string, string | string[]>,
    figmaUrl: input.figmaUrl,
    reflection: input.reflection,
    imagePaths: input.imagePaths,
    step: input.step,
  };

  const supabase = await createClient();
  const savedAt = new Date().toISOString();
  if (isBlankDraft(draft)) {
    const { error } = await supabase.from("submission_drafts").delete().eq("user_id", user.id).eq("challenge_slug", challenge.slug);
    return error ? { ok: false, error: "Couldn't save your progress." } : { ok: true, savedAt };
  }
  const { error } = await supabase.from("submission_drafts").upsert(
    {
      user_id: user.id,
      challenge_slug: challenge.slug,
      challenge_version: challenge.version,
      answers: draft.answers,
      figma_url: draft.figmaUrl || null,
      reflection: draft.reflection || null,
      image_paths: draft.imagePaths,
      current_step: draft.step,
      updated_at: savedAt,
    },
    { onConflict: "user_id,challenge_slug" },
  );
  return error ? { ok: false, error: "Couldn't save your progress." } : { ok: true, savedAt };
}

/** "Start over": remove the signed-in learner's draft for a challenge (their own row, under RLS). */
export async function discardDraft(slugInput: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const slug = slugSchema.safeParse(slugInput);
  if (!user || !slug.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("submission_drafts").delete().eq("user_id", user.id).eq("challenge_slug", slug.data);
  return { ok: !error };
}
