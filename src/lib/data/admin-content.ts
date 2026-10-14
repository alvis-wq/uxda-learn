import "server-only";
import { challengePlaceholders, type AuditRow } from "@/lib/admin/challenge-settings";
import { findPlaceholders } from "@/lib/content/placeholders";
import { requireAdmin } from "@/lib/auth/admin";
import { parseChallenge } from "@/lib/challenges/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { visibleTracks } from "@/lib/tracks";

type AuditSelect = {
  id: number;
  challenge_slug: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  changed_at: string;
  actor: { full_name: string | null; email: string } | null;
};

const PATH_AUDIT_COLUMNS = "id,path_slug,field,old_value,new_value,source,changed_at,actor:profiles!path_settings_audit_changed_by_fkey(full_name,email)";

const AUDIT_COLUMNS = "id,challenge_slug,field,old_value,new_value,source,changed_at,actor:profiles!challenge_settings_audit_changed_by_fkey(full_name,email)";

function toAuditRow(r: AuditSelect): AuditRow {
  return { ...r, actor: r.actor ? (r.actor.full_name ?? r.actor.email) : null };
}

export type FeedbackItem = { id: string; body: string; created_at: string; who: string };

type FeedbackSelect = {
  id: string;
  challenge_slug: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string } | null;
};

const FEEDBACK_COLUMNS = "id,challenge_slug,body,created_at,author:profiles!challenge_feedback_user_id_fkey(full_name,email)";

function toFeedbackItem(r: FeedbackSelect): FeedbackItem {
  return { id: r.id, body: r.body, created_at: r.created_at, who: r.author ? (r.author.full_name ?? r.author.email) : "Former user" };
}

/**
 * Admin → Content: every challenge with its settings, who can see it, placeholders and change
 * history. Public rows and the audit log are read with the admin's RLS client; grader notes
 * (for the placeholder check) need the service role and stay on the server.
 */
export async function getContentOverview() {
  await requireAdmin();
  const supabase = await createClient();
  const [categories, challenges, subs, audit, keys, feedback, paths, pathAudit] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("challenges")
      .select(
        "slug,category_slug,title,summary,body_md,type,audiences,required_for,due_at,difficulty,points,status,version,questions,submission_spec,rubric,path_slug",
      )
      .order("title"),
    supabase.from("submissions").select("challenge_slug").eq("is_test", false),
    supabase.from("challenge_settings_audit").select(AUDIT_COLUMNS).order("changed_at", { ascending: false }),
    createAdminClient().from("challenge_keys").select("challenge_slug,grader_notes"),
    // Admin RLS lets the admin's own client read every note.
    supabase.from("challenge_feedback").select(FEEDBACK_COLUMNS).order("created_at", { ascending: false }),
    supabase.from("paths").select("*").order("title"),
    supabase.from("path_settings_audit").select(PATH_AUDIT_COLUMNS).order("changed_at", { ascending: false }),
  ]);
  for (const res of [categories, challenges, subs, audit, keys, feedback, paths, pathAudit]) {
    if (res.error) throw new Error(`Couldn't load content: ${res.error.message}`);
  }

  const submissionCount = new Map<string, number>();
  for (const s of subs.data ?? []) submissionCount.set(s.challenge_slug, (submissionCount.get(s.challenge_slug) ?? 0) + 1);
  const notes = new Map((keys.data ?? []).map((k) => [k.challenge_slug, k.grader_notes]));
  const history = new Map<string, AuditRow[]>();
  for (const r of (audit.data ?? []) as AuditSelect[]) {
    history.set(r.challenge_slug, [...(history.get(r.challenge_slug) ?? []), toAuditRow(r)]);
  }
  const feedbackBySlug = new Map<string, FeedbackItem[]>();
  for (const r of (feedback.data ?? []) as unknown as FeedbackSelect[]) {
    feedbackBySlug.set(r.challenge_slug, [...(feedbackBySlug.get(r.challenge_slug) ?? []), toFeedbackItem(r)]); // newest first
  }
  const cats = categories.data ?? [];
  const pathHistory = new Map<string, AuditRow[]>();
  for (const r of (pathAudit.data ?? []) as unknown as (AuditSelect & { path_slug: string })[]) {
    pathHistory.set(r.path_slug, [...(pathHistory.get(r.path_slug) ?? []), toAuditRow(r)]);
  }
  const challengeBySlug = new Map((challenges.data ?? []).map((c) => [c.slug, c]));
  const pathBySlug = new Map((paths.data ?? []).map((p) => [p.slug, p]));

  return cats.map((cat) => ({
    category: cat,
    challenges: (challenges.data ?? [])
      .filter((c) => c.category_slug === cat.slug)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        type: c.type,
        audiences: c.audiences,
        difficulty: c.difficulty,
        points: c.points,
        version: c.version,
        status: c.status,
        required_for: c.required_for,
        due_at: c.due_at,
        submissions: submissionCount.get(c.slug) ?? 0,
        visibleTracks: visibleTracks(cat.audiences, c.audiences),
        placeholders: challengePlaceholders({
          challenge: c,
          category: cat,
          graderNotes: notes.get(c.slug) ?? null,
        }),
        history: history.get(c.slug) ?? [],
        feedback: feedbackBySlug.get(c.slug) ?? [],
        path: milestoneOf(c, pathBySlug),
      })),
    paths: (paths.data ?? [])
      .filter((p) => p.category_slug === cat.slug)
      .map((p) => {
        const milestones = p.milestones.flatMap((s) => {
          const c = challengeBySlug.get(s);
          return c ? [{ slug: c.slug, title: c.title, status: c.status, points: c.points }] : [];
        });
        return {
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          status: p.status,
          audiences: p.audiences,
          sequential: p.sequential,
          milestones,
          points: milestones.reduce((sum, m) => sum + m.points, 0),
          placeholders: findPlaceholders({
            title: p.title,
            summary: p.summary,
            "before you start": p.before_you_start,
            "before you submit": p.before_you_submit,
          }),
          history: pathHistory.get(p.slug) ?? [],
        };
      }),
  }));
}

/** "Milestone 2 of 7 · Auto Layout homework" for a challenge in a path. */
function milestoneOf(
  c: { slug: string; path_slug: string | null },
  paths: Map<string, { slug: string; title: string; milestones: string[] }>,
): { slug: string; title: string; position: number; total: number } | null {
  const p = c.path_slug ? paths.get(c.path_slug) : undefined;
  if (!p) return null;
  return { slug: p.slug, title: p.title, position: p.milestones.indexOf(c.slug) + 1, total: p.milestones.length };
}

/**
 * Admin preview: the challenge with its answer key and grader notes merged back in, so content
 * can be reviewed in the app. Admin-only (checked here, not just in the layout); rendered on the
 * server, so the key never reaches a learner's browser.
 */
export async function getChallengePreview(slug: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const [{ data: category }, { data: key }, audit, feedback, tests] = await Promise.all([
    supabase.from("categories").select("title,audiences,archived").eq("slug", row.category_slug).maybeSingle(),
    createAdminClient().from("challenge_keys").select("answer_key,grader_notes").eq("challenge_slug", slug).maybeSingle(),
    supabase
      .from("challenge_settings_audit")
      .select(AUDIT_COLUMNS)
      .eq("challenge_slug", slug)
      .order("changed_at", { ascending: false }),
    supabase.from("challenge_feedback").select(FEEDBACK_COLUMNS).eq("challenge_slug", slug).order("created_at", { ascending: false }),
    // Test attempts: only admins can read them once the challenge is published.
    supabase
      .from("submissions")
      .select("id,attempt,auto_score,max_score,submitted_at,tester:profiles!submissions_user_id_fkey(full_name,email)")
      .eq("challenge_slug", slug)
      .eq("is_test", true)
      .order("submitted_at", { ascending: false }),
  ]);
  if (audit.error) throw new Error(`Couldn't load history: ${audit.error.message}`);
  if (feedback.error) throw new Error(`Couldn't load feedback: ${feedback.error.message}`);
  if (tests.error) throw new Error(`Couldn't load test attempts: ${tests.error.message}`);

  const challenge = parseChallenge(row);
  const answers = (key?.answer_key ?? {}) as Record<string, string | string[] | undefined>;
  // Correct option ids per auto-graded question (null for text questions or a missing key).
  const questions = challenge.questions.map((q) => {
    const a = q.kind === "text" ? undefined : answers[q.id];
    return { ...q, correct: a === undefined ? null : [a].flat() };
  });

  return {
    challenge,
    questions,
    graderNotes: key?.grader_notes ?? null,
    category,
    placeholders: challengePlaceholders({ challenge: row, category, graderNotes: key?.grader_notes ?? null }),
    history: ((audit.data ?? []) as AuditSelect[]).map(toAuditRow),
    feedback: ((feedback.data ?? []) as unknown as FeedbackSelect[]).map(toFeedbackItem),
    testAttempts: (tests.data ?? []).map((t) => ({
      id: t.id,
      attempt: t.attempt,
      score: Number(t.auto_score),
      max: Number(t.max_score),
      submitted_at: t.submitted_at,
      who: t.tester ? (t.tester.full_name ?? t.tester.email) : "Former user",
    })),
  };
}
