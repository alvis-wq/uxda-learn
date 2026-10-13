import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { isOwnImagePath } from "@/lib/submissions/input";

/**
 * A learner's in-progress form, saved server-side (table submission_drafts) so they can carry on later, from any
 * device. Screenshots are kept as Storage paths: the files are already uploaded to the learner's own folder.
 */
export type Draft = {
  answers: Record<string, string | string[]>;
  figmaUrl: string;
  reflection: string;
  imagePaths: string[];
  /** 1-based step the learner was on. */
  step: number;
};

/** The columns of submission_drafts that make up a draft. */
export type DraftRow = {
  challenge_version: number;
  answers: unknown;
  figma_url: string | null;
  reflection: string | null;
  image_paths: string[];
  current_step: number;
  updated_at: string;
};

type Restorable = { slug: string; version: number; questions: readonly PublicQuestion[]; submission_spec: SubmissionSpec };

export type RestoredDraft = {
  draft: Draft;
  /** The challenge changed since the draft was saved and some of its answers no longer fit, so they were dropped. */
  reset: boolean;
};

const MAX_TEXT = 20_000;

/** A form with nothing in it, on the first step: not worth keeping a row for. */
export function isBlankDraft(d: Draft): boolean {
  return (
    d.step === 1 &&
    d.figmaUrl === "" &&
    d.reflection === "" &&
    d.imagePaths.length === 0 &&
    Object.values(d.answers).every((v) => (Array.isArray(v) ? v.length === 0 : v === ""))
  );
}

/**
 * Turns a stored draft into one that fits the challenge as it is now. Never throws and never trusts the row:
 *  - answers are kept only for questions that still exist, and (for choices) only the options that still exist;
 *  - a Figma link, reflection or screenshots survive only if the challenge still asks for them;
 *  - screenshot paths must be the learner's own for this challenge, and within the allowed number;
 *  - the step is clamped to the steps there are now.
 * `reset` says an *older version's* answers were dropped, so the page can tell the learner (a draft saved against the
 * current version never reports it).
 */
export function restoreDraft(row: DraftRow, challenge: Restorable, userId: string, stepCount: number): RestoredDraft {
  const stored =
    typeof row.answers === "object" && row.answers !== null && !Array.isArray(row.answers)
      ? (row.answers as Record<string, unknown>)
      : {};
  let dropped = 0;

  const answers: Draft["answers"] = {};
  for (const q of challenge.questions) {
    const value = stored[q.id];
    if (value === undefined) continue;
    if (q.kind === "text") {
      if (typeof value === "string") answers[q.id] = value.slice(0, MAX_TEXT);
      else dropped++;
    } else {
      const known = new Set(q.options.map((o) => o.id));
      if (q.kind === "single") {
        if (typeof value === "string" && known.has(value)) answers[q.id] = value;
        else dropped++;
      } else {
        const list = Array.isArray(value) ? value : [];
        const kept = [...new Set(list.filter((v): v is string => typeof v === "string" && known.has(v)))];
        if (kept.length > 0) answers[q.id] = kept;
        if (kept.length < list.length || !Array.isArray(value)) dropped++;
      }
    }
  }
  const questionIds = new Set(challenge.questions.map((q) => q.id));
  dropped += Object.keys(stored).filter((id) => !questionIds.has(id)).length;

  const spec = challenge.submission_spec;
  const figmaStored = row.figma_url ?? "";
  const reflectionStored = row.reflection ?? "";
  const figmaUrl = spec.figma_url ? figmaStored.slice(0, 2000) : "";
  const reflection = spec.reflection ? reflectionStored.slice(0, MAX_TEXT) : "";
  if (figmaStored && !figmaUrl) dropped++;
  if (reflectionStored && !reflection) dropped++;

  const max = spec.screenshots?.max ?? 0;
  const ownPaths = [...new Set(row.image_paths)].filter((p) => isOwnImagePath(p, userId, challenge.slug));
  const imagePaths = ownPaths.slice(0, max);
  if (imagePaths.length < row.image_paths.length) dropped++;

  const step = Number.isInteger(row.current_step) ? row.current_step : 1;
  return {
    draft: { answers, figmaUrl, reflection, imagePaths, step: Math.min(Math.max(step, 1), Math.max(stepCount, 1)) },
    reset: row.challenge_version !== challenge.version && dropped > 0,
  };
}
