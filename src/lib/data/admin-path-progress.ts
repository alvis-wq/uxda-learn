import "server-only";
import { importBlocker } from "@/lib/admin/path-import";
import { requireAdmin } from "@/lib/auth/admin";
import { milestoneStates, summarizePath, type MilestoneState, type PathSummary } from "@/lib/paths/progress";
import { createClient } from "@/lib/supabase/server";
import { isVisibleToTrack, type Track } from "@/lib/tracks";

export type AdminMilestone = {
  slug: string;
  title: string;
  points: number;
  status: string;
  state: MilestoneState;
  attemptsUsed: number;
  /** Imported attempts, newest first; `undoable` only for the user's latest attempt. */
  imports: { id: string; attempt: number; status: string; final_score: number | null; feedback: string | null; undoable: boolean }[];
  /** Why an import isn't possible now; null when it is. */
  blocker: string | null;
};

export type AdminPathProgress = {
  slug: string;
  title: string;
  status: string;
  summary: PathSummary;
  milestones: AdminMilestone[];
};

export type ImportAuditEntry = {
  id: number;
  action: string;
  challenge_slug: string;
  status: string;
  final_score: number;
  max_score: number;
  source: string;
  changed_at: string;
  who: string;
};

type ImportAuditSelect = Omit<ImportAuditEntry, "who"> & { actor: { full_name: string | null; email: string } | null };

/**
 * Admin → Users → a user: their progress through every path their track can see (any status but archived, so a
 * draft path shows too, with "Publish the path first"), what can be imported where, and the import history. Read
 * with the admin's own client (RLS lets admins read every row).
 */
export async function getUserPathProgress(userId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id,full_name,email,track").eq("id", userId).maybeSingle();
  if (!profile) return null;

  const [paths, categories, subs, audit] = await Promise.all([
    supabase.from("paths").select("*").neq("status", "archived").order("title"),
    supabase.from("categories").select("slug,archived,audiences"),
    supabase
      .from("submissions")
      .select("id,challenge_slug,attempt,status,final_score,max_score,feedback,is_imported")
      .eq("user_id", userId)
      .eq("is_test", false),
    supabase
      .from("submission_import_audit")
      .select("id,action,challenge_slug,status,final_score,max_score,source,changed_at,actor:profiles!submission_import_audit_changed_by_fkey(full_name,email)")
      .eq("user_id", userId)
      .order("changed_at", { ascending: false }),
  ]);
  for (const res of [paths, categories, subs, audit]) {
    if (res.error) throw new Error(`Couldn't load path progress: ${res.error.message}`);
  }
  const track = profile.track as Track | null;
  const catBySlug = new Map((categories.data ?? []).map((c) => [c.slug, c]));
  const visiblePaths = (paths.data ?? []).filter((p) => {
    const cat = catBySlug.get(p.category_slug);
    return cat && !cat.archived && isVisibleToTrack(cat.audiences, track) && isVisibleToTrack(p.audiences, track);
  });

  const slugs = visiblePaths.flatMap((p) => p.milestones);
  const { data: rows, error } = slugs.length
    ? await supabase.from("challenges").select("slug,title,points,status,audiences").in("slug", slugs)
    : { data: [], error: null };
  if (error) throw new Error(`Couldn't load milestones: ${error.message}`);
  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));

  const result: AdminPathProgress[] = visiblePaths.map((p) => {
    const milestones = p.milestones
      .map((s) => rowBySlug.get(s))
      .filter((r): r is NonNullable<typeof r> => !!r && r.status !== "archived" && isVisibleToTrack(r.audiences, track));
    const attemptsOf = (slug: string) => (subs.data ?? []).filter((s) => s.challenge_slug === slug);
    const states = milestoneStates(
      p.sequential,
      milestones.map((m) => ({ slug: m.slug, title: m.title, points: m.points, attempts: attemptsOf(m.slug), testing: false, hasDraft: false })),
    );
    return {
      slug: p.slug,
      title: p.title,
      status: p.status,
      summary: summarizePath(states),
      milestones: milestones.map((m, i) => {
        const attempts = attemptsOf(m.slug);
        const latest = Math.max(0, ...attempts.map((a) => a.attempt));
        return {
          slug: m.slug,
          title: m.title,
          points: m.points,
          status: m.status,
          state: states[i],
          attemptsUsed: attempts.length,
          imports: attempts
            .filter((a) => a.is_imported)
            .sort((a, b) => b.attempt - a.attempt)
            .map((a) => ({
              id: a.id,
              attempt: a.attempt,
              status: a.status,
              final_score: a.final_score,
              feedback: a.feedback,
              undoable: a.attempt === latest,
            })),
          blocker: importBlocker({ pathStatus: p.status, milestoneStatus: m.status, points: m.points, attempts }),
        };
      }),
    };
  });

  const history: ImportAuditEntry[] = ((audit.data ?? []) as unknown as ImportAuditSelect[]).map(({ actor, ...r }) => ({
    ...r,
    who: r.source === "script" ? `Import script (${actor?.full_name ?? actor?.email ?? "former admin"})` : (actor?.full_name ?? actor?.email ?? "Former admin"),
  }));

  return { profile, paths: result, history };
}
