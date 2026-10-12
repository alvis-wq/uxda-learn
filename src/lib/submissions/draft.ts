import type { PublicQuestion } from "@/lib/content/schema";

/**
 * A learner's in-progress answers, kept in sessionStorage so a refresh doesn't lose them. Screenshots are not part of
 * it: their previews are browser-only object URLs, so after a refresh they are added again. Cleared on submit.
 * Keyed by user, challenge and content version, so a changed challenge or another account never picks up old answers.
 */
export type Draft = {
  answers: Record<string, string | string[]>;
  figmaUrl: string;
  reflection: string;
  /** 1-based step the learner was on. */
  step: number;
};

const MAX_TEXT = 20_000;

export function draftKey(userId: string, slug: string, version: number): string {
  return `uxda:draft:${userId}:${slug}:v${version}`;
}

export function serializeDraft(draft: Draft): string {
  return JSON.stringify(draft);
}

/** Parses a stored draft, keeping only what is still valid for these questions. Never throws. */
export function parseDraft(raw: string | null, questions: readonly PublicQuestion[], stepCount: number): Draft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const input = data as Record<string, unknown>;

  const answers: Draft["answers"] = {};
  const stored = typeof input.answers === "object" && input.answers !== null ? (input.answers as Record<string, unknown>) : {};
  for (const q of questions) {
    const value = stored[q.id];
    if (q.kind === "text") {
      if (typeof value === "string") answers[q.id] = value.slice(0, MAX_TEXT);
    } else {
      const known = new Set(q.options.map((o) => o.id));
      if (q.kind === "single" && typeof value === "string" && known.has(value)) answers[q.id] = value;
      if (q.kind === "multi" && Array.isArray(value)) {
        const ids = [...new Set(value.filter((v): v is string => typeof v === "string" && known.has(v)))];
        if (ids.length > 0) answers[q.id] = ids;
      }
    }
  }

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const step = typeof input.step === "number" && Number.isInteger(input.step) ? input.step : 1;
  return {
    answers,
    figmaUrl: text(input.figmaUrl, 2000),
    reflection: text(input.reflection, MAX_TEXT),
    step: Math.min(Math.max(step, 1), Math.max(stepCount, 1)),
  };
}

// sessionStorage can be missing or throw (private windows, blocked site data), so every access is guarded.
export function loadDraftRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: Draft): void {
  try {
    window.sessionStorage.setItem(key, serializeDraft(draft));
  } catch {
    // Storage unavailable or full: the draft just isn't kept.
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
