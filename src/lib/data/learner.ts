import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/session";
import { isVisibleToTrack, parseChallenge, type Challenge } from "@/lib/challenges/model";
import { attemptState, type AttemptState, type AttemptSummary } from "@/lib/submissions/rules";

/**
 * Learner-facing reads. All go through the user's RLS-scoped client and then apply the
 * product rules on top (published only, audience = all + own track) — admins can read
 * drafts via RLS, but learner pages must not show them.
 */

type SubmissionLite = AttemptSummary & { challenge_slug: string };

async function mySubmissions(userId: string, slug?: string): Promise<SubmissionLite[]> {
  const supabase = await createClient();
  let q = supabase
    .from("submissions")
    .select("challenge_slug,attempt,status,final_score,max_score")
    .eq("user_id", userId);
  if (slug) q = q.eq("challenge_slug", slug);
  const { data, error } = await q;
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);
  return data;
}

function groupBySlug(subs: SubmissionLite[]) {
  const map = new Map<string, SubmissionLite[]>();
  for (const s of subs) map.set(s.challenge_slug, [...(map.get(s.challenge_slug) ?? []), s]);
  return map;
}

export type CategoryProgress = {
  slug: string;
  title: string;
  description: string | null;
  total: number;
  completed: number;
  pointsEarned: number;
  pointsPossible: number;
};

export async function getHomeCategories(profile: Profile): Promise<CategoryProgress[]> {
  const supabase = await createClient();
  const [cats, chs, subs] = await Promise.all([
    supabase.from("categories").select("slug,title,description,audience,sort_order").eq("archived", false).order("sort_order"),
    supabase.from("challenges").select("slug,category_slug,audience,points").eq("status", "published"),
    mySubmissions(profile.id),
  ]);
  if (cats.error) throw new Error(`Couldn't load categories: ${cats.error.message}`);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  const bySlug = groupBySlug(subs);

  return cats.data
    .filter((c) => isVisibleToTrack(c.audience, profile.track))
    .map((c) => {
      const challenges = chs.data.filter(
        (ch) => ch.category_slug === c.slug && isVisibleToTrack(ch.audience, profile.track),
      );
      let completed = 0;
      let pointsEarned = 0;
      for (const ch of challenges) {
        const best = attemptState(bySlug.get(ch.slug) ?? []).bestScore;
        if (best !== null) {
          completed++;
          pointsEarned += best;
        }
      }
      return {
        slug: c.slug,
        title: c.title,
        description: c.description,
        total: challenges.length,
        completed,
        pointsEarned,
        pointsPossible: challenges.reduce((s, ch) => s + ch.points, 0),
      };
    });
}

export async function getCategoryPage(profile: Profile, slug: string) {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("slug,title,description,audience,archived")
    .eq("slug", slug)
    .maybeSingle();
  if (!category || category.archived || !isVisibleToTrack(category.audience, profile.track)) return null;

  const [chs, subs] = await Promise.all([
    supabase
      .from("challenges")
      .select("slug,title,summary,type,difficulty,points,estimated_minutes,audience,due_at")
      .eq("category_slug", slug)
      .eq("status", "published")
      .order("difficulty")
      .order("title"),
    mySubmissions(profile.id),
  ]);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  const bySlug = groupBySlug(subs);

  return {
    category,
    challenges: chs.data
      .filter((ch) => isVisibleToTrack(ch.audience, profile.track))
      .map((ch) => ({ ...ch, state: attemptState(bySlug.get(ch.slug) ?? []) })),
  };
}

export type ChallengePageData = {
  challenge: Challenge;
  categoryTitle: string;
  state: AttemptState;
  attempts: {
    id: string;
    attempt: number;
    status: AttemptSummary["status"];
    final_score: number | null;
    max_score: number;
    feedback: string | null;
    submitted_at: string;
  }[];
  preview: boolean; // admin viewing something learners can't see
};

export async function getChallengePage(profile: Profile, slug: string): Promise<ChallengePageData | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const { data: category } = await supabase
    .from("categories")
    .select("title,archived,audience")
    .eq("slug", row.category_slug)
    .maybeSingle();

  const learnerVisible =
    row.status === "published" &&
    !!category &&
    !category.archived &&
    isVisibleToTrack(category.audience, profile.track) &&
    isVisibleToTrack(row.audience, profile.track);
  if (!learnerVisible && !profile.is_admin) return null;

  const { data: attempts, error } = await supabase
    .from("submissions")
    .select("id,attempt,status,final_score,max_score,feedback,submitted_at")
    .eq("user_id", profile.id)
    .eq("challenge_slug", slug)
    .order("attempt");
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);

  return {
    challenge: parseChallenge(row),
    categoryTitle: category?.title ?? row.category_slug,
    state: attemptState(attempts),
    attempts,
    preview: !learnerVisible,
  };
}
