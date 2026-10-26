import "server-only";
import { requireLead } from "@/lib/auth/lead";
import { createClient } from "@/lib/supabase/server";
import type { TeamInput } from "@/lib/team/progress";

/**
 * Everything the Team page needs, read with the viewer's own client. Content (published challenges and paths,
 * categories) comes through the usual RLS; people and their progress only through the team_* functions, which refuse
 * anyone who isn't a lead or an admin and return no answers, feedback or emails. Test attempts never reach them.
 */
export async function loadTeamInput(): Promise<TeamInput> {
  await requireLead();
  const supabase = await createClient();
  const [members, categories, challenges, paths, submissions, acknowledgements] = await Promise.all([
    supabase.rpc("team_members"),
    supabase.from("categories").select("slug,title,sort_order,archived,audiences"),
    supabase
      .from("challenges")
      .select("slug,title,category_slug,type,status,audiences,difficulty,points,path_slug")
      .eq("status", "published"),
    supabase
      .from("paths")
      .select("slug,title,category_slug,status,audiences,sequential,milestones")
      .eq("status", "published"),
    supabase.rpc("team_submissions"),
    supabase.rpc("team_acknowledgements"),
  ]);
  for (const res of [members, categories, challenges, paths, submissions, acknowledgements]) {
    if (res.error) throw new Error(`Couldn't load team progress: ${res.error.message}`);
  }
  return {
    // The generated types call set-returning function columns non-null; these two can be null.
    members: (members.data ?? []).map((m) => ({ ...m, full_name: m.full_name ?? null, avatar_url: m.avatar_url ?? null })),
    categories: categories.data ?? [],
    challenges: challenges.data ?? [],
    paths: paths.data ?? [],
    submissions: (submissions.data ?? []).map((s) => ({
      ...s,
      final_score: s.final_score === null ? null : Number(s.final_score),
      max_score: Number(s.max_score),
    })),
    acknowledgements: acknowledgements.data ?? [],
  };
}
