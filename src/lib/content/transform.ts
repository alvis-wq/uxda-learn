import { createHash } from "node:crypto";
import type { LoadedChallenge } from "./load";
import type { Audience } from "@/lib/tracks";
import { shuffleItems } from "./order";
import type { Category, PathFile, PublicQuestion, Question } from "./schema";

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

export function toPublicQuestion(q: Question): PublicQuestion {
  if (q.kind === "text") return q;
  // The authored items are in the correct order: store them shuffled, never as written.
  if (q.kind === "order") return { ...q, items: shuffleItems(q.id, q.items) };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answer, ...rest } = q;
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
  questions: PublicQuestion[];
  submission_spec: Record<string, unknown>;
  rubric: unknown[];
  /** Card artwork (a file in public/challenges/). Display only: not in PUBLIC_KEYS, so it never changes content_hash. */
  image: string | null;
  /** Short markdown hint shown above the questions. Display only, like `image`: it never changes content_hash. */
  tip: string | null;
  /** The learning path this challenge is a milestone of. Display only, like `image`: it never changes content_hash. */
  path_slug: string | null;
  content_hash: string;
};

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
export type PublicChallengeContent = Omit<ChallengeRow, "content_hash" | "image" | "tip" | "path_slug">;

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
export function hashPublicContent(content: PublicChallengeContent): string {
  const picked = Object.fromEntries(PUBLIC_KEYS.map((k) => [k, content[k] ?? null]));
  return createHash("sha256").update(canonicalJson(picked)).digest("hex");
}

export type ChallengeKeyRow = {
  challenge_slug: string;
  answer_key: Record<string, string | string[]>;
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
  before_you_start: string | null;
  before_you_submit: string[];
};

export function toPathRow(p: PathFile, categories: Category[]): { row: PathRow; status: ChallengeSettings["status"] } {
  return {
    row: {
      slug: p.slug,
      category_slug: p.category,
      title: p.title,
      summary: p.summary,
      audiences: p.audiences ?? categories.find((c) => c.slug === p.category)?.audiences ?? ["all"],
      sequential: p.sequential,
      milestones: p.milestones,
      before_you_start: p.before_you_start ?? null,
      before_you_submit: p.before_you_submit,
    },
    status: p.status,
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
    questions: c.questions.map(toPublicQuestion),
    submission_spec: (c.submission ?? {}) as Record<string, unknown>,
    rubric: c.rubric,
  };
  const content_hash = hashPublicContent(publicContent);

  const answer_key: Record<string, string | string[]> = {};
  for (const q of c.questions) {
    if (q.kind === "single") answer_key[q.id] = q.answer;
    else if (q.kind === "multi") answer_key[q.id] = [...q.answer].sort();
    else if (q.kind === "order") answer_key[q.id] = q.items.map((item) => item.id); // the sequence matters: not sorted
  }

  return {
    challenge: { ...publicContent, image: c.image ?? null, tip: c.tip ?? null, path_slug: c.path ?? null, content_hash },
    settings: { status: c.status, required_for: c.required_for ?? [], due_at: normalizeTimestamp(c.due_at) },
    key: { challenge_slug: c.slug, answer_key, grader_notes: c.grader_notes?.trim() || null },
  };
}
