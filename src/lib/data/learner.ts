import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/session";
import { isChallengeVisible, parseChallenge, type Challenge } from "@/lib/challenges/model";
import { requiredFirst, requiredState, sortByUrgency, type RequiredState } from "@/lib/challenges/required";
import { resolveCardImage } from "@/lib/challenges/card";
import { draftProgress, type DraftProgress } from "@/lib/challenges/draft-progress";
import type { DraftRow } from "@/lib/submissions/draft";
import { groupForTrack, isRequiredFor, isVisibleToTrack } from "@/lib/tracks";
import {
  attemptState,
  rankOf,
  summarizeScores,
  type AttemptState,
  type AttemptSummary,
  type SubmissionStatus,
} from "@/lib/submissions/rules";

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

/** The learner's saved drafts by challenge slug, with the step each was saved on (RLS: their own rows only). */
type Drafts = ReadonlyMap<string, { step: number }>;

async function myDrafts(userId: string): Promise<Drafts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("submission_drafts").select("challenge_slug,current_step").eq("user_id", userId);
  if (error) throw new Error(`Couldn't load your drafts: ${error.message}`);
  return new Map(data.map((d) => [d.challenge_slug, { step: d.current_step }]));
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
  /** A saved draft the learner could still continue (they have attempts left and aren't awaiting review). */
  inProgress: boolean;
  /** How far along that draft is; null without a draft, or for a challenge without a Stepper. */
  draftProgress: DraftProgress | null;
};

function progressFor(
  ch: {
    slug: string;
    type: Challenge["type"];
    required_for: Challenge["required_for"];
    due_at: string | null;
    questions: unknown;
    submission_spec: unknown;
  },
  profile: Profile,
  subs: AttemptSummary[],
  acks: Map<string, string>,
  drafts: Drafts,
  now: Date,
): ChallengeProgress {
  const state = attemptState(subs);
  const acknowledgedAt = acks.get(ch.slug) ?? null;
  const done = ch.type === "acknowledge" ? acknowledgedAt !== null : state.bestScore !== null;
  const draft = drafts.get(ch.slug);
  const inProgress = ch.type !== "acknowledge" && state.canSubmit && draft !== undefined;
  return {
    state,
    acknowledgedAt,
    done,
    required: isRequiredFor(ch.required_for, profile.track),
    requiredState: requiredState({ done, latestStatus: state.latest?.status, dueAt: ch.due_at, now }),
    inProgress,
    draftProgress: inProgress ? draftProgress(ch, draft.step) : null,
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

/** Everything a challenge card shows, resolved for the signed-in learner. */
export type CardChallenge = {
  slug: string;
  title: string;
  summary: string | null;
  categoryTitle: string;
  type: Challenge["type"];
  difficulty: number;
  points: number;
  estimated_minutes: number | null;
  due_at: string | null;
  required: boolean;
  done: boolean;
  requiredState: RequiredState;
  latestStatus: SubmissionStatus | null;
  acknowledged: boolean;
  bestScore: number | null;
  /** The learner has saved, unsubmitted work on it. */
  inProgress: boolean;
  /** "Step 2 of 5" for that work; null when there is none or the challenge has no Stepper. */
  draftProgress: DraftProgress | null;
  /** Public URL of the card artwork (the challenge's own, else its category's), or null. */
  imageUrl: string | null;
};

type CardSource = {
  slug: string;
  title: string;
  summary: string | null;
  type: Challenge["type"];
  difficulty: number;
  points: number;
  estimated_minutes: number | null;
  due_at: string | null;
  image: string | null;
};

function cardOf(
  ch: CardSource,
  category: { title: string; image: string | null },
  p: ChallengeProgress,
): CardChallenge {
  return {
    slug: ch.slug,
    title: ch.title,
    summary: ch.summary,
    categoryTitle: category.title,
    type: ch.type,
    difficulty: ch.difficulty,
    points: ch.points,
    estimated_minutes: ch.estimated_minutes,
    due_at: ch.due_at,
    required: p.required,
    done: p.done,
    requiredState: p.requiredState,
    latestStatus: p.state.latest?.status ?? null,
    acknowledged: p.acknowledgedAt !== null,
    bestScore: p.state.bestScore,
    inProgress: p.inProgress,
    draftProgress: p.draftProgress,
    imageUrl: resolveCardImage(ch.image, category.image),
  };
}

export type HomeHero = {
  totalScore: number;
  /** Scored challenges completed, out of the scored ones visible to the learner. */
  completed: number;
  totalScored: number;
  groupLabel: string | null;
  /** Null when the learner isn't on the leaderboard (hidden from it). */
  rank: { position: number; of: number } | null;
};

export type HomeData = {
  hero: HomeHero;
  categories: CategoryProgress[];
  required: { total: number; done: number; outstanding: CardChallenge[]; overdue: number };
};

export async function getHomeData(profile: Profile, now = new Date()): Promise<HomeData> {
  const supabase = await createClient();
  const group = groupForTrack(profile.track);
  const [cats, chs, subs, acks, drafts, board] = await Promise.all([
    supabase
      .from("categories")
      .select("slug,title,description,audiences,sort_order,archived,image")
      .eq("archived", false)
      .order("sort_order"),
    supabase
      .from("challenges")
      .select("slug,title,summary,category_slug,type,status,difficulty,audiences,required_for,due_at,points,estimated_minutes,image,questions,submission_spec")
      .eq("status", "published"),
    mySubmissions(profile.id),
    myAcknowledgements(profile.id),
    myDrafts(profile.id),
    group ? supabase.rpc("get_leaderboard", { p_tracks: [...group.tracks] }) : Promise.resolve(null),
  ]);
  if (cats.error) throw new Error(`Couldn't load categories: ${cats.error.message}`);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  if (board?.error) throw new Error(`Couldn't load the leaderboard: ${board.error.message}`);
  const bySlug = groupBySlug(subs);
  const catBySlug = new Map(cats.data.map((c) => [c.slug, c]));

  const visible = chs.data
    .filter((ch) => isChallengeVisible(ch, catBySlug.get(ch.category_slug), profile.track))
    .map((ch) => ({ ...ch, ...progressFor(ch, profile, bySlug.get(ch.slug) ?? [], acks, drafts, now) }));

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
  const outstanding = sortByUrgency(required.filter((ch) => !ch.done)).map((ch) => {
    const category = catBySlug.get(ch.category_slug);
    return cardOf(ch, { title: category?.title ?? "", image: category?.image ?? null }, ch);
  });

  const { totalScore, completed } = summarizeScores(subs);
  const hero: HomeHero = {
    totalScore,
    completed,
    totalScored: visible.filter((ch) => ch.type !== "acknowledge").length,
    groupLabel: group?.label ?? null,
    rank: board?.data ? rankOf(board.data, profile.id) : null,
  };

  return {
    hero,
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
    .select("slug,title,description,audiences,archived,image")
    .eq("slug", slug)
    .maybeSingle();
  if (!category || category.archived || !isVisibleToTrack(category.audiences, profile.track)) return null;

  const [chs, subs, acks, drafts] = await Promise.all([
    supabase
      .from("challenges")
      .select("slug,title,summary,type,status,difficulty,points,estimated_minutes,audiences,required_for,due_at,image,questions,submission_spec")
      .eq("category_slug", slug)
      .eq("status", "published")
      .order("difficulty")
      .order("title"),
    mySubmissions(profile.id),
    myAcknowledgements(profile.id),
    myDrafts(profile.id),
  ]);
  if (chs.error) throw new Error(`Couldn't load challenges: ${chs.error.message}`);
  const bySlug = groupBySlug(subs);

  return {
    category,
    challenges: requiredFirst(
      chs.data
        .filter((ch) => isChallengeVisible(ch, category, profile.track))
        .map((ch) => {
          const progress = progressFor(ch, profile, bySlug.get(ch.slug) ?? [], acks, drafts, now);
          return { ...cardOf(ch, category, progress), required: progress.required };
        }),
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
  /** The learner's saved draft for this challenge, if any. */
  draft: DraftRow | null;
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

  const [{ data: attempts, error }, acks, { data: draft }] = await Promise.all([
    supabase
      .from("submissions")
      .select("id,attempt,status,final_score,max_score,feedback,submitted_at")
      .eq("user_id", profile.id)
      .eq("challenge_slug", slug)
      .order("attempt"),
    myAcknowledgements(profile.id),
    supabase
      .from("submission_drafts")
      .select("challenge_version,answers,figma_url,reflection,image_paths,current_step,updated_at")
      .eq("user_id", profile.id)
      .eq("challenge_slug", slug)
      .maybeSingle(),
  ]);
  if (error) throw new Error(`Couldn't load your submissions: ${error.message}`);

  return {
    challenge: parseChallenge(row),
    categoryTitle: category?.title ?? row.category_slug,
    progress: progressFor(row, profile, attempts, acks, new Map(draft ? [[slug, { step: draft.current_step }]] : []), now),
    attempts,
    preview: !learnerVisible,
    draft,
  };
}
