/**
 * Unfinished-content markers such as `TODO` or `TODO_FIGMA_URL`. A challenge that still contains
 * one can't be published (content:validate for files that say `status: published`, and the
 * admin panel's publish action). Upper case only, so prose like "a todo list" isn't flagged.
 */
const PLACEHOLDER = /\bTODO(?:_[A-Z0-9]+)*\b/g;

export type PlaceholderHit = { token: string; where: string };

/** Every placeholder in the given labelled values (strings, or nested objects/arrays of them). */
export function findPlaceholders(parts: Record<string, unknown>): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown, where: string) => {
    if (typeof value === "string") {
      for (const [token] of value.matchAll(PLACEHOLDER)) {
        const id = `${token}\u0000${where}`;
        if (!seen.has(id)) {
          seen.add(id);
          hits.push({ token, where });
        }
      }
    } else if (Array.isArray(value)) {
      for (const v of value) visit(v, where);
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) visit(v, where);
    }
  };
  for (const [where, value] of Object.entries(parts)) visit(value, where);
  return hits;
}

/** The parts of a challenge that are checked, with the labels used in messages. */
export function challengeParts(c: {
  title: string;
  summary?: string | null;
  body: string;
  tip?: string | null;
  questions?: unknown;
  submission?: unknown;
  rubric?: unknown;
  grader_notes?: string | null;
}): Record<string, unknown> {
  return {
    title: c.title,
    summary: c.summary,
    brief: c.body,
    tip: c.tip,
    questions: c.questions,
    "submission instructions": c.submission,
    rubric: c.rubric,
    "grader notes": c.grader_notes,
  };
}

/** "TODO_FIGMA_URL (brief, grader notes)" — one entry per token. */
export function describePlaceholders(hits: PlaceholderHit[]): string {
  const byToken = new Map<string, string[]>();
  for (const h of hits) byToken.set(h.token, [...(byToken.get(h.token) ?? []), h.where]);
  return [...byToken].map(([token, where]) => `${token} (${where.join(", ")})`).join("; ");
}
