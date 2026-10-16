import { existsSync } from "node:fs";
import path from "node:path";
import type { ContentError, LoadedContent } from "./load";
import { audienceTracks, onlyHiddenTracks, TRACK_LABEL, visibleTracks, type Audience, type Track } from "@/lib/tracks";
import { briefImageErrors } from "./images";
import { IMAGE_TUNING_FIELDS } from "./transform";
import { challengeParts, describePlaceholders, findPlaceholders } from "./placeholders";
import { needsReview } from "./schema";

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) (seen.has(v) ? dups : seen).add(v);
  return [...dups];
}

/** Cross-file and semantic rules on top of the Zod schemas. Returns all errors found. */
export function validateContent(
  content: LoadedContent,
  /** Where card images live (public/challenges); a referenced file must exist there. */
  imageDir = path.join(process.cwd(), "public", "challenges"),
): ContentError[] {
  const errors: ContentError[] = [...content.errors];
  const err = (file: string, message: string) => errors.push({ file, message });

  for (const slug of duplicates(content.categories.map((c) => c.slug))) {
    err("categories.yaml", `duplicate category slug "${slug}"`);
  }
  const categoriesBySlug = new Map(content.categories.map((c) => [c.slug, c]));
  const missingImage = (image: string | undefined) => image !== undefined && !existsSync(path.join(imageDir, image));
  for (const c of content.categories) {
    if (missingImage(c.image)) err("categories.yaml", `category "${c.slug}": image "${c.image}" not found in public/challenges/`);
  }

  for (const slug of duplicates(content.challenges.map((c) => c.data.slug))) {
    const files = content.challenges.filter((c) => c.data.slug === slug).map((c) => c.file);
    err(files.join(", "), `duplicate challenge slug "${slug}"`);
  }

  for (const { file, data: c, body } of content.challenges) {
    const expectedFile = `challenges/${c.slug}.md`;
    if (file !== expectedFile) err(file, `slug "${c.slug}" must match the filename (${expectedFile})`);

    const category = categoriesBySlug.get(c.category);
    if (!category) err(file, `unknown category "${c.category}"`);

    // Audiences: a challenge can narrow its category's audiences, never widen them.
    const categoryTracks = category ? audienceTracks(category.audiences) : [];
    if (category && c.audiences && !c.audiences.includes("all")) {
      for (const t of c.audiences) {
        if (!(categoryTracks as Audience[]).includes(t)) {
          err(file, `audiences: ${TRACK_LABEL[t as Track]} can't see category "${category.slug}"`);
        }
      }
    }
    // Required for a track that can't see it → nobody on that track could ever complete it.
    if (category && c.required_for) {
      const visible = visibleTracks(category.audiences, c.audiences ?? category.audiences);
      for (const t of audienceTracks(c.required_for)) {
        if (!visible.includes(t)) {
          err(file, `required_for: ${TRACK_LABEL[t]} can't see this challenge (check audiences of the challenge and its category)`);
        }
      }
    }

    if (c.waiting_minutes !== undefined) {
      if (c.estimated_minutes === undefined) err(file, "waiting_minutes: needs estimated_minutes (the total time) too");
      else if (c.waiting_minutes > c.estimated_minutes) {
        err(file, `waiting_minutes: ${c.waiting_minutes} is more than estimated_minutes (${c.estimated_minutes}); waiting is part of the total`);
      }
    }

    if (missingImage(c.image)) err(file, `image: "${c.image}" not found in public/challenges/`);
    for (const f of tuningWithoutImage(c)) err(file, `${f}: tunes this file's own illustration, so it needs \`image\` here too`);
    if (!body) err(file, "brief (markdown body) is empty");
    for (const m of briefImageErrors(body, (name) => existsSync(path.join(imageDir, name)))) err(file, m);

    // A file can only publish a challenge when it's first created; never with placeholders in it.
    if (c.status === "published") {
      const hits = findPlaceholders(challengeParts({ ...c, body }));
      if (hits.length) {
        err(file, `status: published, but the content still has placeholders: ${describePlaceholders(hits)} — keep it draft until they're filled in`);
      }
    }

    for (const qid of duplicates(c.questions.map((q) => q.id))) {
      err(file, `duplicate question id "${qid}"`);
    }
    for (const rid of duplicates(c.rubric.map((r) => r.id))) {
      err(file, `duplicate rubric id "${rid}"`);
    }

    for (const q of c.questions) {
      if (q.kind === "text") continue;
      if (q.kind === "match") {
        const categoryIds = q.categories.map((cat) => cat.id);
        for (const cid of duplicates(categoryIds)) err(file, `question ${q.id}: duplicate category id "${cid}"`);
        for (const label of duplicates(q.categories.map((cat) => cat.label.trim().toLowerCase()))) {
          err(file, `question ${q.id}: two categories are both "${label}" — each category must be different`);
        }
        for (const iid of duplicates(q.items.map((item) => item.id))) err(file, `question ${q.id}: duplicate item id "${iid}"`);
        for (const label of duplicates(q.items.map((item) => item.label.trim().toLowerCase()))) {
          err(file, `question ${q.id}: two items are both "${label}" — each item must be different`);
        }
        for (const item of q.items) {
          if (!categoryIds.includes(item.match)) err(file, `question ${q.id}: item "${item.id}" matches "${item.match}", which is not a category id`);
        }
        continue;
      }
      if (q.kind === "order") {
        for (const iid of duplicates(q.items.map((item) => item.id))) err(file, `question ${q.id}: duplicate item id "${iid}"`);
        for (const label of duplicates(q.items.map((item) => item.label.trim().toLowerCase()))) {
          err(file, `question ${q.id}: two items are both "${label}" — each item must be different`);
        }
        continue;
      }
      const optionIds = q.options.map((o) => o.id);
      for (const oid of duplicates(optionIds)) err(file, `question ${q.id}: duplicate option id "${oid}"`);
      const answers = q.kind === "single" ? [q.answer] : q.answer;
      for (const a of answers) {
        if (!optionIds.includes(a)) err(file, `question ${q.id}: answer "${a}" is not an option id`);
      }
      if (q.kind === "multi" && duplicates(q.answer).length) {
        err(file, `question ${q.id}: answer lists an option twice`);
      }
    }

    if (c.type === "acknowledge") {
      if (c.questions.length || c.submission || c.rubric.length || c.grader_notes) {
        err(file, "acknowledge challenges have no questions, submission, rubric or grader_notes");
      }
      if (c.points !== undefined && c.points !== 0) err(file, "acknowledge challenges are worth 0 points");
      continue;
    }

    if (c.difficulty === undefined) err(file, "difficulty: is required");
    if (c.points === undefined) {
      err(file, "points: is required");
    } else if (c.points === 0) {
      err(file, "points: must be positive (only acknowledge challenges are worth 0)");
    }

    const questionPoints = c.questions.reduce((sum, q) => sum + q.points, 0);
    const rubricPoints = c.rubric.reduce((sum, r) => sum + r.points, 0);
    if (c.points !== undefined && questionPoints + rubricPoints !== c.points) {
      err(
        file,
        `points mismatch: points is ${c.points} but questions (${questionPoints}) + rubric (${rubricPoints}) = ${questionPoints + rubricPoints}`,
      );
    }

    if (c.type === "quiz") {
      if (c.questions.length === 0) err(file, "quiz challenges need at least one question");
      if (needsReview(c)) {
        err(file, "quiz challenges may only contain single/multi/order/match questions and no submission section");
      }
    } else if (!c.submission) {
      err(file, `type "${c.type}" needs a submission section`);
    }
    // Instant feedback checks every answer on its own, so nothing in the challenge can wait for a review.
    if (c.feedback_mode === "instant" && (c.type !== "quiz" || needsReview(c))) {
      err(file, "feedback_mode: instant only works on a quiz whose questions are all single, multi, order or match");
    }

    if (c.type === "figma" && !c.submission?.figma_url) {
      err(file, 'type "figma" needs submission.figma_url');
    }
    if (c.type === "screenshot" && !c.submission?.screenshots) {
      err(file, 'type "screenshot" needs submission.screenshots');
    }

    if (needsReview(c) && c.rubric.length === 0) {
      err(file, "challenges that need review must have a rubric");
    }
    if (needsReview(c) && !c.grader_notes?.trim()) {
      err(file, "challenges that need review must have grader_notes");
    }
  }

  validatePaths(content, categoriesBySlug, missingImage, err);
  return errors;
}

/** Illustration tuning set in a file that has no `image` of its own (a category's image can't be tuned per file). */
function tuningWithoutImage(data: { image?: string } & Partial<Record<(typeof IMAGE_TUNING_FIELDS)[number], number>>): string[] {
  return data.image ? [] : IMAGE_TUNING_FIELDS.filter((f) => data[f] !== undefined);
}

/** A chain of `requires` that leads from a path back to itself (e.g. [a, b, a]), or null. Self-requires are reported apart. */
function requiresLoop(start: string, pathsBySlug: Map<string, LoadedContent["paths"][number]>): string[] | null {
  const seen = new Set<string>();
  const walk = (slug: string, chain: string[]): string[] | null => {
    for (const next of pathsBySlug.get(slug)?.data.requires ?? []) {
      if (next === slug) continue;
      if (next === start) return [...chain, next];
      if (seen.has(next)) continue;
      seen.add(next);
      const found = walk(next, [...chain, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, [start]);
}

/** Same audience list, ignoring order ("all" only equals "all"). */
function sameAudiences(a: readonly Audience[], b: readonly Audience[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Learning paths (content/paths/*.yaml) and their milestones: every listed slug exists, points back at the path with
 * `path:`, is listed once and in one path only; every challenge with `path:` is listed there; a milestone shares its
 * path's category and audiences; it is never `acknowledge` and is never required or due on its own (its path can be).
 * A path's `required_for` only names tracks that can see it. `requires` names
 * other existing paths, never itself, and never goes round in a loop.
 */
function validatePaths(
  content: LoadedContent,
  categoriesBySlug: Map<string, LoadedContent["categories"][number]>,
  missingImage: (image: string | undefined) => boolean,
  err: (file: string, message: string) => void,
) {
  for (const slug of duplicates(content.paths.map((p) => p.data.slug))) {
    const files = content.paths.filter((p) => p.data.slug === slug).map((p) => p.file);
    err(files.join(", "), `duplicate path slug "${slug}"`);
  }
  const challengesBySlug = new Map(content.challenges.map((c) => [c.data.slug, c]));
  const pathsBySlug = new Map(content.paths.map((p) => [p.data.slug, p]));
  const resolved = (own: Audience[] | undefined, categorySlug: string): Audience[] =>
    own ?? categoriesBySlug.get(categorySlug)?.audiences ?? [];
  const listedIn = new Map<string, string[]>();

  for (const { file, data: p } of content.paths) {
    if (file !== `paths/${p.slug}.yaml`) err(file, `slug "${p.slug}" must match the filename (paths/${p.slug}.yaml)`);
    if (missingImage(p.image)) err(file, `image: "${p.image}" not found in public/challenges/`);
    for (const f of tuningWithoutImage(p)) err(file, `${f}: tunes this file's own illustration, so it needs \`image\` here too`);
    const category = categoriesBySlug.get(p.category);
    if (!category) err(file, `unknown category "${p.category}"`);
    if (category && p.audiences && !p.audiences.includes("all")) {
      const categoryTracks = audienceTracks(category.audiences) as Audience[];
      for (const t of p.audiences) {
        if (!categoryTracks.includes(t)) err(file, `audiences: ${TRACK_LABEL[t as Track]} can't see category "${category.slug}"`);
      }
    }
    // Required for a track that can't see the path → nobody on that track could ever complete it.
    if (category && p.required_for) {
      const visible = visibleTracks(category.audiences, p.audiences ?? category.audiences);
      for (const t of audienceTracks(p.required_for)) {
        if (!visible.includes(t)) err(file, `required_for: ${TRACK_LABEL[t]} can't see this path (check audiences of the path and its category)`);
      }
    }
    for (const slug of duplicates(p.milestones)) err(file, `milestones: "${slug}" is listed twice`);
    for (const slug of duplicates(p.requires)) err(file, `requires: "${slug}" is listed twice`);
    for (const slug of new Set(p.requires)) {
      if (slug === p.slug) err(file, "requires: a path can't require itself");
      else if (!pathsBySlug.has(slug)) err(file, `requires: no path "${slug}" (content/paths/${slug}.yaml)`);
    }
    const loop = requiresLoop(p.slug, pathsBySlug);
    if (loop) err(file, `requires: goes round in a loop (${loop.join(" → ")}), so none of these paths could ever unlock`);

    if (p.status === "published") {
      const hits = findPlaceholders({
        title: p.title,
        summary: p.summary,
        "before you start": p.before_you_start,
        "before you submit": p.before_you_submit,
      });
      if (hits.length) err(file, `status: published, but the path still has placeholders: ${describePlaceholders(hits)}`);
    }

    const pathAudiences = resolved(p.audiences, p.category);
    for (const slug of new Set(p.milestones)) {
      listedIn.set(slug, [...(listedIn.get(slug) ?? []), p.slug]);
      const ch = challengesBySlug.get(slug);
      if (!ch) {
        err(file, `milestones: no challenge "${slug}"`);
        continue;
      }
      const c = ch.data;
      if (c.path !== p.slug) {
        err(file, `milestones: "${slug}" must say \`path: ${p.slug}\`${c.path ? ` (it says path: ${c.path})` : ""}`);
      }
      if (c.category !== p.category) err(file, `milestones: "${slug}" is in category "${c.category}", the path in "${p.category}"`);
      if (!sameAudiences(resolved(c.audiences, c.category), pathAudiences)) {
        err(file, `milestones: "${slug}" must have the same audiences as the path`);
      }
      if (p.status === "published" && c.status !== "published") {
        err(file, `status: published, but milestone "${slug}" is ${c.status}`);
      }
    }
  }

  for (const { file, data: c } of content.challenges) {
    if (!c.path) continue;
    if (!pathsBySlug.has(c.path)) err(file, `path: no path "${c.path}" (content/paths/${c.path}.yaml)`);
    else if (!pathsBySlug.get(c.path)!.data.milestones.includes(c.slug)) err(file, `path: "${c.path}" doesn't list this challenge in its milestones`);
    if ((listedIn.get(c.slug) ?? []).length > 1) err(file, `is a milestone of more than one path (${listedIn.get(c.slug)!.join(", ")})`);
    if (c.type === "acknowledge") err(file, "a path milestone can't be an acknowledge challenge");
    if (c.required_for) err(file, "required_for: a path milestone can't be required on its own");
    if (c.due_at) err(file, "due_at: a path milestone can't have its own due date");
  }
}

/**
 * Not errors, but worth a look: content aimed only at tracks that are no longer offered (account manager, marketing
 * assistant). Nobody can be put on those tracks, so nobody new would see it or have it required. And a help link on a
 * challenge that isn't instant mode, where nothing shows it.
 */
export function contentWarnings(content: LoadedContent): ContentError[] {
  const warnings: ContentError[] = [];
  const hiddenOnly = (list: readonly Audience[] | undefined) =>
    list !== undefined && onlyHiddenTracks(list) ? list.map((a) => TRACK_LABEL[a as Track] ?? a).join(", ") : undefined;

  for (const c of content.categories) {
    const names = hiddenOnly(c.audiences);
    if (names) warnings.push({ file: "categories.yaml", message: `category "${c.slug}" is only for ${names}, which nobody can choose any more` });
  }
  for (const { file, data: c } of content.challenges) {
    const names = hiddenOnly(c.audiences);
    if (names) warnings.push({ file, message: `audiences: only ${names}, which nobody can choose any more` });
    const required = hiddenOnly(c.required_for);
    if (required) warnings.push({ file, message: `required_for: only ${required}, which nobody can choose any more` });
    // Only the instant wrong-answer dialog shows it; anywhere else it's never seen.
    if (c.help_link && c.feedback_mode !== "instant") {
      warnings.push({ file, message: "help_link: only shown in instant mode (feedback_mode: instant), so nobody will see it here" });
    }
  }
  for (const { file, data: p } of content.paths) {
    const names = hiddenOnly(p.audiences);
    if (names) warnings.push({ file, message: `audiences: only ${names}, which nobody can choose any more` });
    const required = hiddenOnly(p.required_for);
    if (required) warnings.push({ file, message: `required_for: only ${required}, which nobody can choose any more` });
  }
  return warnings;
}
