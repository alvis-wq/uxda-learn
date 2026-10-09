/** npm run eval:pull — gather submissions awaiting AI review into .eval/<batch_id>/. */
import "./lib/env";
import { pullBatch } from "./lib/eval/pull";
import { adminClient } from "./lib/supabase";

pullBatch(adminClient(), { baseDir: ".eval" })
  .then(({ batchId, dir, manifest }) => {
    const imgs = manifest.submissions.flatMap((s) => s.images);
    const failed = imgs.filter((i) => !i.local_path);
    console.log(`Batch ${batchId}: ${manifest.submissions.length} submission(s), ${imgs.length - failed.length} image(s).`);
    if (failed.length) console.warn(`  ${failed.length} image(s) could not be downloaded (see manifest).`);
    console.log(`Manifest: ${dir}/manifest.json`);
    console.log(`Write results to ${dir}/results.json, then: npm run eval:push -- ${batchId}`);
    console.log(`BATCH_ID=${batchId}`);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
