/** npm run eval:push -- <batch_id> — validate results.json and store AI evaluations. */
import "./lib/env";
import { EvalValidationError, pushBatch } from "./lib/eval/push";
import { adminClient } from "./lib/supabase";

const batchId = process.argv[2];
if (!batchId) {
  console.error("Usage: npm run eval:push -- <batch_id>");
  process.exit(1);
}

pushBatch(adminClient(), { baseDir: ".eval", batchId })
  .then(({ outcomes, missing }) => {
    const count = (o: string) => outcomes.filter((x) => x.outcome === o).length;
    console.log(
      `Batch ${batchId}: ${count("inserted")} inserted, ${count("updated")} updated, ${count("unchanged")} unchanged, ` +
        `${count("skipped_reviewed")} skipped (already reviewed by an admin), ${count("skipped_superseded")} skipped (newer batch exists), ` +
        `${count("skipped_edited")} skipped (changed by the learner since the pull — run /evaluate again).`,
    );
    if (missing.length) console.warn(`No result for ${missing.length} submission(s) in the manifest: ${missing.join(", ")}`);
  })
  .catch((err) => {
    console.error(err instanceof EvalValidationError ? err.message : `eval:push failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
