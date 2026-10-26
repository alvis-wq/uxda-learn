import type { ProgressSubmission } from "@/lib/admin/required-progress";
import { isChallengeVisible, type Challenge } from "@/lib/challenges/model";
import { milestoneStates, summarizePath } from "@/lib/paths/progress";
import { attemptState } from "@/lib/submissions/rules";
import type { Audience, Track } from "@/lib/tracks";

/**
 * Pure builder for the Team page: who has finished which challenge, grouped by category. People are rows; each
 * category's challenges and paths are columns (a path is ONE column for all its milestones, as everywhere else).
 * Only status, best score and when it was completed; nothing a learner wrote.
 */

export type TeamMember = { id: string; full_name: string | null; avatar_url: string | null; track: Track | null };
export type TeamCategory = { slug: string; title: string; sort_order: number; archived: boolean; audiences: Audience[] };
export type TeamChallenge = {
  slug: string;
  title: string;
  category_slug: string;
  type: Challenge["type"];
  status: string;
  audiences: Audience[];
  difficulty: number;
  points: number;
  /** Set for a path milestone: it shows inside its path's column, never on its own. */
  path_slug: string | null;
};
export type TeamPath = {
  slug: string;
  title: string;
  category_slug: string;
  status: string;
  audiences: Audience[];
  sequential: boolean;
  milestones: string[];
};
export type TeamAck = { user_id: string; challenge_slug: string; acknowledged_at: string };

export type TeamInput = {
  members: TeamMember[];
  categories: TeamCategory[];
  /** Published challenges (milestones included). */
  challenges: TeamChallenge[];
  /** Published paths. */
  paths: TeamPath[];
  /** Real attempts only: test attempts never reach this (team_submissions() leaves them out). */
  submissions: ProgressSubmission[];
  acknowledgements: TeamAck[];
};

export type TeamCellState = "done" | "review" | "resubmit" | "partial" | "not_started" | "hidden";

export const TEAM_STATE_LABEL: Record<TeamCellState, string> = {
  done: "Done",
  review: "Awaiting review",
  resubmit: "Changes requested",
  partial: "In progress",
  not_started: "Not started",
  hidden: "Not for their track",
};

export type TeamColumn = {
  kind: "challenge" | "path";
  slug: string;
  title: string;
  /** The challenge type; null for a path. */
  type: Challenge["type"] | null;
};

export type TeamGroup = { slug: string; title: string; columns: TeamColumn[] };

export type TeamCell = {
  state: TeamCellState;
  /** Best published score (a path: the sum over its milestones); null when nothing is published. */
  bestScore: number | null;
  maxPoints: number;
  /** First publish (a path: when its last milestone got its first score); null until done. */
  completedAt: string | null;
  /** A path: milestones done / milestones this person can see. */
  milestonesDone?: number;
  milestonesTotal?: number;
};

export type TeamRow = {
  member: TeamMember & { track: Track };
  /** One cell per column, in the order of `groups` and their columns. */
  cells: TeamCell[];
  done: number;
  /** Columns this person's track can see. */
  visible: number;
};

export type TeamMatrix = {
  groups: TeamGroup[];
  rows: TeamRow[];
  /** Every category that has columns for the people shown (for the category filter), whatever `category` is. */
  categories: { slug: string; title: string }[];
};

const HIDDEN: TeamCell = { state: "hidden", bestScore: null, maxPoints: 0, completedAt: null };

function firstPublished(subs: ProgressSubmission[]): string | null {
  return (
    subs
      .filter((s) => s.status === "published" && s.published_at)
      .map((s) => s.published_at as string)
      .sort()[0] ?? null
  );
}

function challengeCell(ch: TeamChallenge, subs: ProgressSubmission[], ack: TeamAck | undefined): TeamCell {
  if (ch.type === "acknowledge") {
    return { state: ack ? "done" : "not_started", bestScore: null, maxPoints: 0, completedAt: ack?.acknowledged_at ?? null };
  }
  const { bestScore, latest } = attemptState(subs);
  // Done = a score that counts; a retry awaiting review doesn't undo it.
  const state: TeamCellState =
    bestScore !== null
      ? "done"
      : latest?.status === "submitted" || latest?.status === "ai_reviewed"
        ? "review"
        : latest?.status === "needs_resubmission"
          ? "resubmit"
          : "not_started";
  return { state, bestScore, maxPoints: ch.points, completedAt: state === "done" ? firstPublished(subs) : null };
}

function pathCell(milestones: TeamChallenge[], subsFor: (slug: string) => ProgressSubmission[], sequential: boolean): TeamCell {
  if (milestones.length === 0) return HIDDEN;
  const states = milestoneStates(
    sequential,
    milestones.map((m) => ({ slug: m.slug, title: m.title, points: m.points, attempts: subsFor(m.slug), testing: false, hasDraft: false })),
  );
  const summary = summarizePath(states);
  const firsts = milestones.map((m) => firstPublished(subsFor(m.slug)));
  const state: TeamCellState = summary.complete
    ? "done"
    : states.some((s) => s.submitted)
      ? "partial"
      : "not_started";
  return {
    state,
    bestScore: states.some((s) => s.bestScore !== null) ? summary.pointsEarned : null,
    maxPoints: summary.pointsPossible,
    completedAt: summary.complete && firsts.every(Boolean) ? (firsts as string[]).sort().at(-1)! : null,
    milestonesDone: summary.done,
    milestonesTotal: summary.total,
  };
}

type Column = TeamColumn & { difficulty: number; cell: (member: TeamMember & { track: Track }) => TeamCell };

/**
 * The matrix for everyone onboarded (or one track). Columns nobody shown can see are left out, and so are categories
 * left with none. `category` narrows the columns to one category.
 */
export function buildTeamMatrix(input: TeamInput, filter: { track?: Track; category?: string } = {}): TeamMatrix {
  const cats = new Map(input.categories.map((c) => [c.slug, c]));
  const subs = new Map<string, ProgressSubmission[]>();
  for (const s of input.submissions) {
    const key = `${s.user_id}/${s.challenge_slug}`;
    subs.set(key, [...(subs.get(key) ?? []), s]);
  }
  const acks = new Map(input.acknowledgements.map((a) => [`${a.user_id}/${a.challenge_slug}`, a]));
  const challengeBySlug = new Map(input.challenges.map((c) => [c.slug, c]));

  const members = input.members
    .filter((m): m is TeamMember & { track: Track } => m.track !== null && (!filter.track || m.track === filter.track))
    .sort((a, b) => (a.full_name === null ? 1 : 0) - (b.full_name === null ? 1 : 0) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  const byCategory = new Map<string, Column[]>();
  const add = (slug: string, col: Column) => byCategory.set(slug, [...(byCategory.get(slug) ?? []), col]);

  for (const ch of input.challenges) {
    if (ch.status !== "published" || ch.path_slug) continue;
    add(ch.category_slug, {
      kind: "challenge",
      slug: ch.slug,
      title: ch.title,
      type: ch.type,
      difficulty: ch.difficulty,
      cell: (m) =>
        isChallengeVisible(ch, cats.get(ch.category_slug), m.track)
          ? challengeCell(ch, subs.get(`${m.id}/${ch.slug}`) ?? [], acks.get(`${m.id}/${ch.slug}`))
          : HIDDEN,
    });
  }
  for (const path of input.paths) {
    if (path.status !== "published") continue;
    const published = path.milestones
      .map((s) => challengeBySlug.get(s))
      .filter((m): m is TeamChallenge => !!m && m.status === "published");
    if (published.length === 0) continue;
    add(path.category_slug, {
      kind: "path",
      slug: path.slug,
      title: path.title,
      type: null,
      // Sorts like its card: by its easiest milestone.
      difficulty: Math.min(...published.map((m) => m.difficulty)),
      cell: (m) => {
        if (!isChallengeVisible(path, cats.get(path.category_slug), m.track)) return HIDDEN;
        const visible = published.filter((ms) => isChallengeVisible(ms, cats.get(ms.category_slug), m.track));
        return pathCell(visible, (slug) => subs.get(`${m.id}/${slug}`) ?? [], path.sequential);
      },
    });
  }

  const allGroups = [...input.categories]
    .filter((c) => !c.archived)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
    .map((c) => {
      const columns = (byCategory.get(c.slug) ?? [])
        .sort((a, b) => a.difficulty - b.difficulty || a.title.localeCompare(b.title))
        .map((col) => ({ col, cells: members.map((m) => col.cell(m)) }))
        // Keep a column when someone shown can see it.
        .filter(({ cells }) => cells.some((cell) => cell.state !== "hidden"));
      return { slug: c.slug, title: c.title, columns };
    })
    .filter((g) => g.columns.length > 0);

  const shown = filter.category ? allGroups.filter((g) => g.slug === filter.category) : allGroups;
  const flat = shown.flatMap((g) => g.columns);

  return {
    categories: allGroups.map((g) => ({ slug: g.slug, title: g.title })),
    groups: shown.map((g) => ({
      slug: g.slug,
      title: g.title,
      columns: g.columns.map(({ col }) => ({ kind: col.kind, slug: col.slug, title: col.title, type: col.type })),
    })),
    rows: members.map((member, i) => {
      const cells = flat.map(({ cells }) => cells[i]);
      return {
        member,
        cells,
        done: cells.filter((c) => c.state === "done").length,
        visible: cells.filter((c) => c.state !== "hidden").length,
      };
    }),
  };
}
