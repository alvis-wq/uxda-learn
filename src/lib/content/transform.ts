import { createHash } from "node:crypto";
import type { LoadedChallenge } from "./load";
import type { Category, PublicQuestion, Question } from "./schema";

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
  type: "quiz" | "screenshot" | "figma" | "mixed";
  audience: "all" | "strategist" | "designer";
  difficulty: number;
  points: number;
  estimated_minutes: number | null;
  questions: PublicQuestion[];
  submission_spec: Record<string, unknown>;
  rubric: unknown[];
  content_hash: string;
  status: "draft" | "published" | "archived";
  due_at: string | null;
};

export type ChallengeKeyRow = {
  challenge_slug: string;
  answer_key: Record<string, string | string[]>;
  grader_notes: string | null;
};

export type CategoryRow = {
  slug: string;
  title: string;
  description: string | null;
  audience: "all" | "strategist" | "designer";
  sort_order: number;
  archived: boolean;
};

export function toCategoryRow(c: Category): CategoryRow {
  return {
    slug: c.slug,
    title: c.title,
    description: c.description ?? null,
    audience: c.audience,
    sort_order: c.sort_order,
    archived: false,
  };
}

/**
 * Split a challenge into its public row and its private key row.
 *
 * content_hash covers ONLY public fields: users can read it, and a hash over answers
 * could be brute-forced for small quizzes. Status is excluded so publishing doesn't bump
 * the version. Private (key) changes are detected by comparing challenge_keys directly.
 */
export function toChallengeRows(
  ch: LoadedChallenge,
  categories: Category[],
): { challenge: ChallengeRow; key: ChallengeKeyRow } {
  const c = ch.data;
  const category = categories.find((cat) => cat.slug === c.category);
  const audience = c.audience ?? category?.audience ?? "all";
  const publicContent = {
    slug: c.slug,
    category_slug: c.category,
    title: c.title,
    summary: c.summary ?? deriveSummary(ch.body),
    body_md: ch.body,
    type: c.type,
    audience,
    difficulty: c.difficulty,
    points: c.points,
    estimated_minutes: c.estimated_minutes ?? null,
    questions: c.questions.map(toPublicQuestion),
    submission_spec: (c.submission ?? {}) as Record<string, unknown>,
    rubric: c.rubric,
    due_at: c.due_at ?? null,
  };
  const content_hash = createHash("sha256").update(canonicalJson(publicContent)).digest("hex");

  const answer_key: Record<string, string | string[]> = {};
  for (const q of c.questions) {
    if (q.kind === "single") answer_key[q.id] = q.answer;
    else if (q.kind === "multi") answer_key[q.id] = [...q.answer].sort();
  }

  return {
    challenge: { ...publicContent, content_hash, status: c.status },
    key: { challenge_slug: c.slug, answer_key, grader_notes: c.grader_notes?.trim() || null },
  };
}
