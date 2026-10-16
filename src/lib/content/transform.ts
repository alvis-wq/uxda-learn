import { createHash } from "node:crypto";
import type { LoadedChallenge } from "./load";
import type { Audience } from "@/lib/tracks";
import { shuffleItems } from "./order";
import { matchPair, type Category, type FeedbackMode, type HelpLink, type PathFile, type PublicQuestion, type Question } from "./schema";

/** JSON with object keys sorted, so equal data always serialises identically (jsonb reorders keys). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

/** The question as learners may read it: no answer, no explanation (both live in challenge_keys). */
export function toPublicQuestion(q: Question): PublicQuestion {
  if (q.kind === "text") return q;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { explanation, ...shown } = q;
  // The authored items are in the correct order: store them shuffled, never as written.
  if (shown.kind === "order") return { ...shown, items: shuffleItems(q.id, shown.items) };
  if (shown.kind === "match") {
    const used = shown.items.map((i) => i.match);
    return {
      ...shown,
      // Shuffled like an order question's, so the stored order says nothing about the pairs.
      items: shuffleItems(q.id, shown.items.map(({ id, label }) => ({ id, label }))),
      one_per_category: used.length === shown.categories.length && new Set(used).size === used.length,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answer, ...rest } = shown;
  return rest;
}

/** First paragraph of the brief (minus headings/markdown), as a short summary. */
export function deriveSummary(body: string): string | null {
  const para = body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .map((p) => p.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim()) // images say nothing in a one-line summary
    .find((p) => p && !p.startsWith("|") && !p.startsWith("```"));
  if (!para) return null;
  const plain = para
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 200 ? `${plain.slice(0, 197).trimEnd()}…` : plain;
}

export type ChallengeRow = {
  slug: string;
  category_slug: string;
  title: string;
  summary: string | null;
  body_md: string;
  type: "quiz" | "screenshot" | "figma" | "mixed" | "acknowledge";
  audiences: Audience[];
  difficulty: number;
  points: number;
  estimated_minutes: number | null;
  /** Part of estimated_minutes spent waiting while Claude Code works; hands-on time is calculated, never stored. */
  waiting_minutes: number | null;
  questions: PublicQuestion[];
  submission_spec: Record<string, unknown>;
  rubric: unknown[];
  feedback_mode: FeedbackMode;
  /** Card artwork (a file in public/challenges/). Display only: not in PUBLIC_KEYS, so it never changes content_hash. */
  image: string | null;
  /** Short markdown hint shown above the questions. Display only, like `image`: it never changes content_hash. */
  tip: string | null;
  /** Link to the source material, offered after a wrong answer in instant mode. Display only, like `tip`. */
  help_link: HelpLink | null;
  /** The learning path this challenge is a milestone of. Display only, like `image`: it never changes content_hash. */
  path_slug: string | null;
  content_hash: string;
} & ImageTuning;

/**
 * Hand tuning of a card illustration (`image_scale`, `image_offset_x`, `image_offset_y` in a challenge or path file).
 * Display only, like `image`: never in content_hash. Omitted = no tuning (scale 1, no offset).
 */
export type ImageTuning = { image_scale: number; image_offset_x: number; image_offset_y: number };
export const NO_IMAGE_TUNING: ImageTuning = { image_scale: 1, image_offset_x: 0, image_offset_y: 0 };
export const IMAGE_TUNING_FIELDS = ["image_scale", "image_offset_x", "image_offset_y"] as const satisfies readonly (keyof ImageTuning)[];

export function imageTuningOf(file: Partial<Record<keyof ImageTuning, number>>): ImageTuning {
  return {
    image_scale: file.image_scale ?? NO_IMAGE_TUNING.image_scale,
    image_offset_x: file.image_offset_x ?? NO_IMAGE_TUNING.image_offset_x,
    image_offset_y: file.image_offset_y ?? NO_IMAGE_TUNING.image_offset_y,
  };
}

/** Same tuning; a database row read before the tuning migration (fields missing) counts as untuned. */
export function sameImageTuning(a: ImageTuning, b: Partial<Record<keyof ImageTuning, number | string | null>>): boolean {
  return IMAGE_TUNING_FIELDS.every((f) => Number(b[f] ?? NO_IMAGE_TUNING[f]) === a[f]);
}

/**
 * Operational settings, owned by the admin panel. A content file sets them only when a challenge
 * is first created; content:sync never writes them afterwards. Not part of content_hash, so
 * changing them never bumps the version.
 */
export type ChallengeSettings = {
  status: "draft" | "published" | "archived";
  required_for: Audience[];
  due_at: string | null;
};
export const SETTING_FIELDS = ["status", "required_for", "due_at"] as const satisfies readonly (keyof ChallengeSettings)[];
export type SettingField = (typeof SETTING_FIELDS)[number];

/** The public fields content_hash covers (everything in ChallengeRow except the hash). */
export type PublicChallengeContent = Omit<ChallengeRow, "content_hash" | "image" | "tip" | "help_link" | "path_slug" | keyof ImageTuning>;

const PUBLIC_KEYS = [
  "slug", "category_slug", "title", "summary", "body_md", "type", "audiences", "difficulty", "points",
  "estimated_minutes", "questions", "submission_spec", "rubric",
] as const satisfies readonly (keyof PublicChallengeContent)[];

/** Timestamps compare by instant: the DB returns `+00:00` where content may say `Z`. */
export function normalizeTimestamp(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * sha256 over the public fields only. Also used on rows read back from the DB, so a stale stored
 * hash (e.g. after a format migration) can be told apart from a real content change.
 */
export function hashPublicContent(content: Omit<PublicChallengeContent, "feedback_mode"> & { feedback_mode?: string }): string {
  const picked: Record<string, unknown> = Object.fromEntries(PUBLIC_KEYS.map((k) => [k, content[k] ?? null]));
  // Added later: only hashed when set, so challenges without it keep the hash they had (no version bump, no refresh).
  if (content.waiting_minutes != null) picked.waiting_minutes = content.waiting_minutes;
  if (content.feedback_mode === "instant") picked.feedback_mode = content.feedback_mode;
  return createHash("sha256").update(canonicalJson(picked)).digest("hex");
}

export type ChallengeKeyRow = {
  challenge_slug: string;
  answer_key: Record<string, string | string[]>;
  /** Question id → why the right answer is right. Private, like the key. */
  explanations: Record<string, string>;
  grader_notes: string | null;
};

/** A learning path as stored (content columns; `status` is separate, like a challenge's settings). */
export type PathRow = {
  slug: string;
  category_slug: string;
  title: string;
  summary: string;
  audiences: Audience[];
  sequential: boolean;
  milestones: string[];
  requires: string[];
  before_you_start: string | null;
  before_you_submit: string[];
  /** Card artwork in public/challenges/ (else the category's). Display only. */
  image: string | null;
} & ImageTuning;

/** A path's admin-owned settings: the same three as a challenge's, set from the file only when the path is created. */
export type PathSettings = ChallengeSettings;

export function toPathRow(p: PathFile, categories: Category[]): { row: PathRow; settings: PathSettings } {
  return {
    row: {
      slug: p.slug,
      category_slug: p.category,
      title: p.title,
      summary: p.summary,
      audiences: p.audiences ?? categories.find((c) => c.slug === p.category)?.audiences ?? ["all"],
      sequential: p.sequential,
      milestones: p.milestones,
      requires: p.requires,
      before_you_start: p.before_you_start ?? null,
      before_you_submit: p.before_you_submit,
      image: p.image ?? null,
      ...imageTuningOf(p),
    },
    settings: { status: p.status, required_for: p.required_for ?? [], due_at: normalizeTimestamp(p.due_at) },
  };
}

export type CategoryRow = {
  slug: string;
  title: string;
  description: string | null;
  audiences: Audience[];
  sort_order: number;
  archived: boolean;
  image: string | null;
};

export function toCategoryRow(c: Category): CategoryRow {
  return {
    slug: c.slug,
    title: c.title,
    description: c.description ?? null,
    audiences: c.audiences,
    sort_order: c.sort_order,
    archived: false,
    image: c.image ?? null,
  };
}

/**
 * Split a challenge into its public row and its private key row.
 *
 * content_hash covers ONLY public content fields: users can read it, and a hash over answers
 * could be brute-forced for small quizzes. The operational settings (status, required_for,
 * due_at) are returned separately and excluded from the hash. Private (key) changes are
 * detected by comparing challenge_keys directly.
 */
export function toChallengeRows(
  ch: LoadedChallenge,
  categories: Category[],
): { challenge: ChallengeRow; settings: ChallengeSettings; key: ChallengeKeyRow } {
  const c = ch.data;
  const category = categories.find((cat) => cat.slug === c.category);
  const audiences = c.audiences ?? category?.audiences ?? ["all"];
  const publicContent: PublicChallengeContent = {
    slug: c.slug,
    category_slug: c.category,
    title: c.title,
    summary: c.summary ?? deriveSummary(ch.body),
    body_md: ch.body,
    type: c.type,
    audiences,
    difficulty: c.difficulty ?? 1,
    points: c.points ?? 0,
    estimated_minutes: c.estimated_minutes ?? null,
    waiting_minutes: c.waiting_minutes ?? null,
    questions: c.questions.map(toPublicQuestion),
    submission_spec: (c.submission ?? {}) as Record<string, unknown>,
    rubric: c.rubric,
    feedback_mode: c.feedback_mode,
  };
  const content_hash = hashPublicContent(publicContent);

  const answer_key: Record<string, string | string[]> = {};
  const explanations: Record<string, string> = {};
  for (const q of c.questions) {
    if (q.kind === "single") answer_key[q.id] = q.answer;
    else if (q.kind === "multi") answer_key[q.id] = [...q.answer].sort();
    else if (q.kind === "order") answer_key[q.id] = q.items.map((item) => item.id); // the sequence matters: not sorted
    else if (q.kind === "match") answer_key[q.id] = q.items.map((item) => matchPair(item.id, item.match)).sort();
    if (q.kind !== "text" && q.explanation) explanations[q.id] = q.explanation;
  }

  return {
    challenge: {
      ...publicContent,
      image: c.image ?? null,
      ...imageTuningOf(c),
      tip: c.tip ?? null,
      help_link: c.help_link ?? null,
      path_slug: c.path ?? null,
      content_hash,
    },
    settings: { status: c.status, required_for: c.required_for ?? [], due_at: normalizeTimestamp(c.due_at) },
    key: { challenge_slug: c.slug, answer_key, explanations, grader_notes: c.grader_notes?.trim() || null },
  };
}
