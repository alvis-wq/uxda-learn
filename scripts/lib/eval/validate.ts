import type { Manifest, Results } from "./schema";

export type PlannedEvaluation = Results["results"][number] & { final_score: number };

/**
 * Cross-check results.json against the manifest it answers. Pure: returns every problem
 * found, so the evaluator can fix them all in one pass. Nothing is written unless this is empty.
 */
export function validateResults(manifest: Manifest, results: Results): {
  errors: string[];
  planned: PlannedEvaluation[];
} {
  const errors: string[] = [];
  const planned: PlannedEvaluation[] = [];

  if (results.batch_id !== manifest.batch_id) {
    errors.push(`batch_id "${results.batch_id}" doesn't match the manifest ("${manifest.batch_id}")`);
  }

  const bySub = new Map(manifest.submissions.map((s) => [s.submission_id, s]));
  const seen = new Set<string>();

  results.results.forEach((r, i) => {
    const at = `results[${i}] (${r.submission_id})`;
    const err = (m: string) => errors.push(`${at}: ${m}`);

    if (seen.has(r.submission_id)) err("duplicate submission_id");
    seen.add(r.submission_id);

    const sub = bySub.get(r.submission_id);
    if (!sub) return err("submission is not in this batch's manifest");

    const items = new Map(sub.review_items.map((it) => [it.id, it]));
    const ids = r.criteria.map((c) => c.id);
    for (const id of ids.filter((id, j) => ids.indexOf(id) !== j)) err(`criterion "${id}" appears twice`);
    for (const c of r.criteria) {
      const item = items.get(c.id);
      if (!item) {
        err(`unknown criterion "${c.id}" (expected: ${[...items.keys()].join(", ")})`);
        continue;
      }
      if (c.max !== item.max) err(`criterion "${c.id}": max is ${c.max}, rubric says ${item.max}`);
      if (c.score > item.max) err(`criterion "${c.id}": score ${c.score} exceeds max ${item.max}`);
    }
    for (const id of items.keys()) if (!ids.includes(id)) err(`missing criterion "${id}"`);

    const sum = r.criteria.reduce((s, c) => s + c.score, 0);
    if (Math.abs(sum - r.total) > 1e-9) err(`total is ${r.total} but criteria add up to ${sum}`);

    const finalScore = sub.auto_score + r.total;
    if (finalScore > sub.max_score) {
      err(`auto_score ${sub.auto_score} + total ${r.total} exceeds max_score ${sub.max_score}`);
    }
    if (r.flags.includes("figma_inaccessible") && r.confidence !== "low") {
      err('flag "figma_inaccessible" requires confidence "low"');
    }
    if (new Set(r.flags).size !== r.flags.length) err("duplicate flags");

    planned.push({ ...r, final_score: finalScore });
  });

  return { errors, planned: errors.length ? [] : planned };
}
