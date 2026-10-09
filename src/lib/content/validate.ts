import type { ContentError, LoadedContent } from "./load";
import { needsReview } from "./schema";

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) (seen.has(v) ? dups : seen).add(v);
  return [...dups];
}

/** Cross-file and semantic rules on top of the Zod schemas. Returns all errors found. */
export function validateContent(content: LoadedContent): ContentError[] {
  const errors: ContentError[] = [...content.errors];
  const err = (file: string, message: string) => errors.push({ file, message });

  for (const slug of duplicates(content.categories.map((c) => c.slug))) {
    err("categories.yaml", `duplicate category slug "${slug}"`);
  }
  const categorySlugs = new Set(content.categories.map((c) => c.slug));

  for (const slug of duplicates(content.challenges.map((c) => c.data.slug))) {
    const files = content.challenges.filter((c) => c.data.slug === slug).map((c) => c.file);
    err(files.join(", "), `duplicate challenge slug "${slug}"`);
  }

  for (const { file, data: c, body } of content.challenges) {
    const expectedFile = `challenges/${c.slug}.md`;
    if (file !== expectedFile) err(file, `slug "${c.slug}" must match the filename (${expectedFile})`);

    if (!categorySlugs.has(c.category)) err(file, `unknown category "${c.category}"`);

    if (!body) err(file, "brief (markdown body) is empty");

    for (const qid of duplicates(c.questions.map((q) => q.id))) {
      err(file, `duplicate question id "${qid}"`);
    }
    for (const rid of duplicates(c.rubric.map((r) => r.id))) {
      err(file, `duplicate rubric id "${rid}"`);
    }

    for (const q of c.questions) {
      if (q.kind === "text") continue;
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

    const questionPoints = c.questions.reduce((sum, q) => sum + q.points, 0);
    const rubricPoints = c.rubric.reduce((sum, r) => sum + r.points, 0);
    if (questionPoints + rubricPoints !== c.points) {
      err(
        file,
        `points mismatch: points is ${c.points} but questions (${questionPoints}) + rubric (${rubricPoints}) = ${questionPoints + rubricPoints}`,
      );
    }

    if (c.type === "quiz") {
      if (c.questions.length === 0) err(file, "quiz challenges need at least one question");
      if (needsReview(c)) {
        err(file, "quiz challenges may only contain single/multi questions and no submission section");
      }
    } else if (!c.submission) {
      err(file, `type "${c.type}" needs a submission section`);
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

  return errors;
}
