import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/session";
import { isChallengeVisible, parseChallenge, type Challenge } from "@/lib/challenges/model";
import { requiredFirst, requiredState, sortByUrgency, type RequiredState } from "@/lib/challenges/required";
import { isRequiredFor, isVisibleToTrack } from "@/lib/tracks";
import { attemptState, type AttemptState, type AttemptSummary } from "@/lib/submissions/rules";

/**
 * Learner-facing reads. All go through the user's RLS-scoped client and then apply the
 * product rules on top (published only, audiences = all + own track) — admins can read
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

async function myAcknowledgements(userId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("acknowledgements")
    .select("challenge_slug,acknowledged_at")
    .eq("user_id", userId);
  if (error) throw new Error(`Couldn't load your acknowledgements: ${error.message}`);
  return new Map(data.map((a) => [a.challenge_slug, a.acknowledged_at]));
}

function groupBySlug(subs: SubmissionLite[]) {
  const map = new Map<string, SubmissionLite[]>();
  for (const s of subs) map.set(s.challenge_slug, [...(map.get(s.challenge_slug) ?? []), s]);
  return map;
}

/** Per-challenge progress for the signed-in learner. */
export type ChallengeProgress = {
  state: AttemptState;
  acknowledgedAt: string | null;
  done: boolean;
  required: boolean;
  requiredState: RequiredState;
};

function progressFor(
  ch: { slug: string; type: Challenge["type"]; required_for: Challenge["required_for"]; due_at: string | null },
  profile: Profile,
  subs: AttemptSummary[],
  acks: Map<string, string>,
  now: Date,
): ChallengeProgress {
  const state = attemptState(subs);
  const acknowledgedAt = acks.get(ch.slug) ?? null;
  const done = ch.type === "acknowledge" ? acknowledgedAt !== null : state.bestScore !== null;
  return {
    state,
    acknowledgedAt,
    done,
    required: isRequiredFor(ch.required_for, profile.track),
    requiredState: requiredState({ done, latestStatus: state.latest?.status, dueAt: ch.due_at, now }),
  };
}

export type CategoryProgress = {
  slug: string;
  title: string;
  description: string | null;
  total: number;
  completed: number;
  pointsEarned: number;
  pointsPossible: number;
  requiredOutstanding: number;
};

export type RequiredItem = {
  slug: string;
  title: string;
  category_slug: string;
  type: Challenge["type"];
  due_at: string | null;
  requiredState: RequiredState;
};

export type HomeData = {
  categories: CategoryProgress[];
  required: { total: number; done: number; outstanding: RequiredItem[]; overdue: number };
};

export async function getHomeData(profile: Profile, now = new Date()): Promise<HomeData> {
  const supabase = await createClient();
  const [cats, chs, subs, acks] = await Promise.all([
    supabase
      .from("categories")
      .select("slug,title,description,audiences,sort_order,archived")
      .eq("archived", false)
      .order("sort_order"),
    supabase
      .from("challenges")
      .select("slug,title,category_slug,type,status,audiences,required_for,due_at,points")
      .eq("status", "published"),
    mySubmissions(profile.id),
    myAcknowledgements(profile.id),
  ]);
  if (cats.error) throw new Error(`Couldn't load categories: ${cats.error.message}`);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  const bySlug = groupBySlug(subs);
  const catBySlug = new Map(cats.data.map((c) => [c.slug, c]));

  const visible = chs.data
    .filter((ch) => isChallengeVisible(ch, catBySlug.get(ch.category_slug), profile.track))
    .map((ch) => ({ ...ch, ...progressFor(ch, profile, bySlug.get(ch.slug) ?? [], acks, now) }));

  const categories = cats.data
    .filter((c) => isVisibleToTrack(c.audiences, profile.track))
    .map((c) => {
      const list = visible.filter((ch) => ch.category_slug === c.slug);
      return {
        slug: c.slug,
        title: c.title,
        description: c.description,
        total: list.length,
        completed: list.filter((ch) => ch.done).length,
        pointsEarned: list.reduce((s, ch) => s + (ch.done ? (ch.state.bestScore ?? 0) : 0), 0),
        pointsPossible: list.reduce((s, ch) => s + ch.points, 0),
        requiredOutstanding: list.filter((ch) => ch.required && !ch.done).length,
      };
    });

  const required = visible.filter((ch) => ch.required);
  const outstanding = sortByUrgency(required.filter((ch) => !ch.done)).map((ch) => ({
    slug: ch.slug,
    title: ch.title,
    category_slug: ch.category_slug,
    type: ch.type,
    due_at: ch.due_at,
    requiredState: ch.requiredState,
  }));

  return {
    categories,
    required: {
      total: required.length,
      done: required.filter((ch) => ch.done).length,
      outstanding,
      overdue: outstanding.filter((ch) => ch.requiredState === "overdue").length,
    },
  };
}

export async function getCategoryPage(profile: Profile, slug: string, now = new Date()) {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("slug,title,description,audiences,archived")
    .eq("slug", slug)
    .maybeSingle();
  if (!category || category.archived || !isVisibleToTrack(category.audiences, profile.track)) return null;

  const [chs, subs, acks] = await Promise.all([
    supabase
      .from("challenges")
      .select("slug,title,summary,type,status,difficulty,points,estimated_minutes,audiences,required_for,due_at")
      .eq("category_slug", slug)
      .eq("status", "published")
      .order("difficulty")
      .order("title"),
    mySubmissions(profile.id),
    myAcknowledgements(profile.id),
  ]);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  const bySlug = groupBySlug(subs);

  return {
    category,
    challenges: requiredFirst(
      chs.data
        .filter((ch) => isChallengeVisible(ch, category, profile.track))
        .map((ch) => ({ ...ch, ...progressFor(ch, profile, bySlug.get(ch.slug) ?? [], acks, now) })),
    ),
  };
}

export type ChallengePageData = {
  challenge: Challenge;
  categoryTitle: string;
  progress: ChallengeProgress;
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

export async function getChallengePage(
  profile: Profile,
  slug: string,
  now = new Date(),
): Promise<ChallengePageData | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const { data: category } = await supabase
    .from("categories")
    .select("title,archived,audiences")
    .eq("slug", row.category_slug)
    .maybeSingle();

  const learnerVisible = isChallengeVisible(row, category, profile.track);
  if (!learnerVisible && !profile.is_admin) return null;

  const [{ data: attempts, error }, acks] = await Promise.all([
    supabase
      .from("submissions")
      .select("id,attempt,status,final_score,max_score,feedback,submitted_at")
      .eq("user_id", profile.id)
      .eq("challenge_slug", slug)
      .order("attempt"),
    myAcknowledgements(profile.id),
  ]);
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);

  return {
    challenge: parseChallenge(row),
    categoryTitle: category?.title ?? row.category_slug,
    progress: progressFor(row, profile, attempts, acks, now),
    attempts,
    preview: !learnerVisible,
  };
}
