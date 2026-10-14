import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isChallengeVisible } from "@/lib/challenges/model";
import {
  milestonePlace,
  milestoneStates,
  summarizePath,
  type MilestoneState,
  type MilestonePlace,
  type PathSummary,
} from "@/lib/paths/progress";
import { isTestChallenge } from "@/lib/submissions/testing";
import type { Track } from "@/lib/tracks";

type Client = SupabaseClient<Database>;

export type PathRecord = Database["public"]["Tables"]["paths"]["Row"];

/**
 * Who sees a path: the same rule as a challenge (published, category not archived, both audiences include the
 * track; a tester also sees a draft). The database enforces it in paths_select; this is the app-side twin for rows
 * read with the service role.
 */
export const isPathVisible = isChallengeVisible;

/**
 * Which of a path's milestones a learner sees: published ones in a published path; in a DRAFT path (a tester trying
 * it) drafts too. A draft milestone inside a published path stays hidden, so a live path's count never includes
 * something nobody can do yet.
 */
export function isMilestoneVisible(
  milestone: { status: string; audiences: Database["public"]["Enums"]["audience"][] },
  path: { status: string },
  category: { archived: boolean; audiences: Database["public"]["Enums"]["audience"][] } | null | undefined,
  track: Track | null | undefined,
  tester: boolean,
): boolean {
  return isChallengeVisible(milestone, category, track, tester && path.status === "draft");
}

export type MilestoneRow = {
  slug: string;
  title: string;
  points: number;
  status: string;
  audiences: Database["public"]["Enums"]["audience"][];
  difficulty: number;
};

export type PathProgress = {
  path: PathRecord;
  category: { slug: string; title: string; archived: boolean; audiences: Database["public"]["Enums"]["audience"][] };
  states: MilestoneState[];
  summary: PathSummary;
  /** Most recent activity on any milestone (attempt or saved work), ISO; null without any. */
  lastActivity: string | null;
};

/**
 * A path and the learner's progress through it, or null when they can't see it. Works with the learner's own client
 * (RLS) and with the service role (server actions): every visibility rule is also applied here. Attempts are real
 * ones, or test ones for a milestone that is a draft (a tester trying a draft path).
 */
export async function loadPathProgress(
  client: Client,
  slug: string,
  viewer: { id: string; track: Track | null; is_tester: boolean },
): Promise<PathProgress | null> {
  const { data: path } = await client.from("paths").select("*").eq("slug", slug).maybeSingle();
  if (!path) return null;
  const { data: category } = await client
    .from("categories")
    .select("slug,title,archived,audiences")
    .eq("slug", path.category_slug)
    .maybeSingle();
  if (!category || !isPathVisible(path, category, viewer.track, viewer.is_tester)) return null;

  const [{ data: rows, error: rowsError }, { data: subs, error: subsError }, { data: drafts, error: draftsError }] = await Promise.all([
    client.from("challenges").select("slug,title,points,status,audiences,difficulty").in("slug", path.milestones),
    client
      .from("submissions")
      // is_test: real and test attempts both, then each milestone keeps only the kind that applies to it (below).
      .select("challenge_slug,attempt,status,final_score,max_score,submitted_at,is_test")
      .eq("user_id", viewer.id)
      .in("challenge_slug", path.milestones),
    client.from("submission_drafts").select("challenge_slug,updated_at").eq("user_id", viewer.id).in("challenge_slug", path.milestones),
  ]);
  if (rowsError || subsError || draftsError) {
    throw new Error(`Couldn't load the path: ${(rowsError ?? subsError ?? draftsError)!.message}`);
  }

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const milestones = path.milestones
    .map((s) => bySlug.get(s))
    .filter((r): r is MilestoneRow => !!r && isMilestoneVisible(r, path, category, viewer.track, viewer.is_tester));
  return { path, category, ...progressOf(path, milestones, subs, drafts) };
}

type SubRow = { challenge_slug: string; attempt: number; status: Database["public"]["Enums"]["submission_status"]; final_score: number | null; max_score: number; submitted_at?: string; is_test: boolean };

/** States, summary and last activity from already-loaded rows (shared by the home page, which loads in bulk). */
export function progressOf(
  path: { sequential: boolean },
  milestones: readonly MilestoneRow[],
  subs: readonly SubRow[],
  drafts: readonly { challenge_slug: string; updated_at: string }[],
): { states: MilestoneState[]; summary: PathSummary; lastActivity: string | null } {
  const draftSlugs = new Set(drafts.map((d) => d.challenge_slug));
  const states = milestoneStates(
    path.sequential,
    milestones.map((m) => {
      const testing = isTestChallenge(m.status);
      return {
        slug: m.slug,
        title: m.title,
        points: m.points,
        testing,
        attempts: subs.filter((s) => s.challenge_slug === m.slug && s.is_test === testing),
        hasDraft: draftSlugs.has(m.slug),
      };
    }),
  );
  const slugs = new Set(milestones.map((m) => m.slug));
  const times = [
    ...subs.filter((s) => slugs.has(s.challenge_slug)).map((s) => s.submitted_at ?? ""),
    ...drafts.filter((d) => slugs.has(d.challenge_slug)).map((d) => d.updated_at),
  ].filter(Boolean);
  return {
    states,
    summary: summarizePath(states),
    lastActivity: times.length ? times.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/**
 * For a milestone challenge: its place in its path (position, lock, next), or `hidden` when the learner can't see the
 * path (so neither the milestone). Null for a challenge that isn't a milestone.
 */
export async function loadMilestonePlace(
  client: Client,
  challenge: { slug: string; path_slug: string | null },
  viewer: { id: string; track: Track | null; is_tester: boolean },
): Promise<MilestonePlace | "hidden" | null> {
  if (!challenge.path_slug) return null;
  const progress = await loadPathProgress(client, challenge.path_slug, viewer);
  if (!progress) return "hidden";
  return milestonePlace(progress.path, progress.states, challenge.slug) ?? "hidden";
}
