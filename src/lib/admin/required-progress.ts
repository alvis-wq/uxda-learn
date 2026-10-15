import { isChallengeVisible, type Challenge } from "@/lib/challenges/model";
import { countStates, requiredState, sortByUrgency, type RequiredState } from "@/lib/challenges/required";
import { milestoneStates, requiredPathState } from "@/lib/paths/progress";
import { attemptState, type SubmissionStatus } from "@/lib/submissions/rules";
import { isRequiredFor, TRACK_LABEL, type Audience, type Track } from "@/lib/tracks";

/** Pure builders for the admin "Required progress" and "Acknowledgements" views and CSV. */

export type ProgressProfile = { id: string; full_name: string | null; email: string; track: Track | null };
export type ProgressCategory = { slug: string; archived: boolean; audiences: Audience[] };
export type ProgressChallenge = {
  slug: string;
  title: string;
  category_slug: string;
  type: Challenge["type"];
  status: string;
  audiences: Audience[];
  required_for: Audience[];
  due_at: string | null;
};
export type ProgressSubmission = {
  user_id: string;
  challenge_slug: string;
  attempt: number;
  status: SubmissionStatus;
  final_score: number | null;
  max_score: number;
  published_at: string | null;
};
/** A published learning path: one required item when its required_for includes the user's track. */
export type ProgressPath = {
  slug: string;
  title: string;
  category_slug: string;
  status: string;
  audiences: Audience[];
  required_for: Audience[];
  due_at: string | null;
  sequential: boolean;
  milestones: string[];
};
export type ProgressAck = { user_id: string; challenge_slug: string; acknowledged_at: string; challenge_version: number };

export type ProgressInput = {
  profiles: ProgressProfile[];
  categories: ProgressCategory[];
  challenges: ProgressChallenge[];
  /** Published paths (their milestones are among `challenges`). Left out = none. */
  paths?: ProgressPath[];
  submissions: ProgressSubmission[];
  acknowledgements: ProgressAck[];
  now: Date;
};

export type RequiredProgressItem = {
  /** A required challenge, or a required learning path (one item for all its milestones). */
  kind: "challenge" | "path";
  slug: string;
  title: string;
  /** The challenge type; null for a path. */
  type: Challenge["type"] | null;
  due_at: string | null;
  state: RequiredState;
  completedAt: string | null;
};

export type RequiredProgressRow = {
  user: ProgressProfile & { track: Track };
  items: RequiredProgressItem[];
  counts: Record<RequiredState, number>;
};

function indexBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

/** Done = a published attempt (earliest publish date) or an acknowledgement. */
function completion(
  ch: ProgressChallenge,
  subs: ProgressSubmission[],
  ack: ProgressAck | undefined,
): { done: boolean; completedAt: string | null; latestStatus: SubmissionStatus | null } {
  if (ch.type === "acknowledge") {
    return { done: !!ack, completedAt: ack?.acknowledged_at ?? null, latestStatus: null };
  }
  const state = attemptState(subs);
  const published = subs
    .filter((s) => s.status === "published" && s.published_at)
    .map((s) => s.published_at as string)
    .sort();
  return { done: state.bestScore !== null, completedAt: published[0] ?? null, latestStatus: state.latest?.status ?? null };
}

/**
 * A required path for one user: its state from the milestones they can see (see requiredPathState), and when it was
 * completed (the last milestone's first published score). Null when they can see none of its milestones.
 */
function pathCompletion(
  path: ProgressPath,
  milestones: ProgressChallenge[],
  subsFor: (slug: string) => ProgressSubmission[],
  now: Date,
): { state: RequiredState; completedAt: string | null } | null {
  if (milestones.length === 0) return null;
  const states = milestoneStates(
    path.sequential,
    milestones.map((m) => ({ slug: m.slug, title: m.title, points: 0, attempts: subsFor(m.slug), testing: false, hasDraft: false })),
  );
  const state = requiredPathState(states, path.due_at, now);
  if (state !== "done") return { state, completedAt: null };
  const firsts = milestones.map((m) =>
    subsFor(m.slug)
      .filter((s) => s.status === "published" && s.published_at)
      .map((s) => s.published_at as string)
      .sort()[0] ?? "",
  );
  return { state, completedAt: firsts.every(Boolean) ? firsts.sort().at(-1)! : null };
}

/** One row per onboarded user (optionally of one track) with every required challenge and path they can see. */
export function buildRequiredProgress(input: ProgressInput, track?: Track): RequiredProgressRow[] {
  const cats = new Map(input.categories.map((c) => [c.slug, c]));
  const subs = indexBy(input.submissions, (s) => `${s.user_id}/${s.challenge_slug}`);
  const acks = new Map(input.acknowledgements.map((a) => [`${a.user_id}/${a.challenge_slug}`, a]));
  const challengeBySlug = new Map(input.challenges.map((c) => [c.slug, c]));

  return input.profiles
    .filter((p): p is ProgressProfile & { track: Track } => p.track !== null && (!track || p.track === track))
    .map((user) => {
      const items: RequiredProgressItem[] = input.challenges
        .filter(
          (ch) =>
            isRequiredFor(ch.required_for, user.track) &&
            isChallengeVisible(ch, cats.get(ch.category_slug), user.track),
        )
        .map((ch): RequiredProgressItem => {
          const key = `${user.id}/${ch.slug}`;
          const c = completion(ch, subs.get(key) ?? [], acks.get(key));
          return {
            kind: "challenge" as const,
            slug: ch.slug,
            title: ch.title,
            type: ch.type,
            due_at: ch.due_at,
            state: requiredState({ done: c.done, latestStatus: c.latestStatus, dueAt: ch.due_at, now: input.now }),
            completedAt: c.completedAt,
          };
        });
      // Required paths: one item each, over the published milestones this user can see (a milestone's own
      // required_for is always empty, so it never shows up above).
      for (const path of input.paths ?? []) {
        if (path.status !== "published") continue;
        if (!isRequiredFor(path.required_for, user.track) || !isChallengeVisible(path, cats.get(path.category_slug), user.track)) continue;
        const milestones = path.milestones
          .map((s) => challengeBySlug.get(s))
          .filter((m): m is ProgressChallenge => !!m && isChallengeVisible(m, cats.get(m.category_slug), user.track));
        const c = pathCompletion(path, milestones, (slug) => subs.get(`${user.id}/${slug}`) ?? [], input.now);
        if (c) items.push({ kind: "path", slug: path.slug, title: path.title, type: null, due_at: path.due_at, ...c });
      }
      const sorted = sortByUrgency(items.map((i) => ({ ...i, requiredState: i.state }))).map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ requiredState, ...i }) => i,
      );
      return { user, items: sorted, counts: countStates(items.map((i) => i.state)) };
    });
}

export const REQUIRED_CSV_HEADER = [
  "name",
  "email",
  "track",
  "challenge_slug",
  "challenge_title",
  "state",
  "due_at",
  "completed_at",
  "item_type", // challenge | path (added last, so older imports keep working)
];

/** One CSV row per (user, required challenge or path). A path's slug and title go in the challenge columns. */
export function requiredProgressCsvRows(rows: RequiredProgressRow[]): (string | number)[][] {
  return rows.flatMap(({ user, items }) =>
    items.map((i) => [
      user.full_name ?? "",
      user.email,
      TRACK_LABEL[user.track],
      i.slug,
      i.title,
      i.state,
      i.due_at ?? "",
      i.completedAt ?? "",
      i.kind,
    ]),
  );
}

export type AcknowledgementOverview = {
  challenge: ProgressChallenge;
  acknowledged: { user: ProgressProfile; at: string; version: number }[];
  missing: ProgressProfile[];
};

/** For each published acknowledge challenge: who confirmed (and when) and who hasn't, among users who can see it. */
export function buildAcknowledgementOverview(input: ProgressInput): AcknowledgementOverview[] {
  const cats = new Map(input.categories.map((c) => [c.slug, c]));
  const acks = new Map(input.acknowledgements.map((a) => [`${a.user_id}/${a.challenge_slug}`, a]));
  return input.challenges
    .filter((ch) => ch.type === "acknowledge" && ch.status === "published")
    .map((ch) => {
      const audience = input.profiles.filter(
        (p) => p.track !== null && isChallengeVisible(ch, cats.get(ch.category_slug), p.track),
      );
      const acknowledged = audience
        .map((user) => ({ user, ack: acks.get(`${user.id}/${ch.slug}`) }))
        .filter((x): x is { user: ProgressProfile; ack: ProgressAck } => !!x.ack)
        .map(({ user, ack }) => ({ user, at: ack.acknowledged_at, version: ack.challenge_version }))
        .sort((a, b) => a.at.localeCompare(b.at));
      const done = new Set(acknowledged.map((a) => a.user.id));
      return { challenge: ch, acknowledged, missing: audience.filter((p) => !done.has(p.id)) };
    });
}
