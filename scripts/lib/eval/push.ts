import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/lib/database.types";
import { canonicalJson } from "../../../src/lib/content/transform";
import { formatZodIssues } from "../../../src/lib/content/load";
import { batchIdSchema, manifestSchema, resultsSchema } from "./schema";
import { validateResults } from "./validate";

type Db = SupabaseClient<Database>;

export class EvalValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`results.json is invalid:\n  ${problems.join("\n  ")}`);
  }
}

export type PushOutcome = "inserted" | "updated" | "unchanged" | "skipped_reviewed" | "skipped_superseded";

/**
 * Validate .eval/<batch_id>/results.json against its manifest, then write evaluations and
 * move submissions to ai_reviewed (final_score = auto_score + total).
 * Idempotent: evaluations are keyed by (submission_id, batch_id); submissions an admin has
 * already reviewed are never touched.
 */
export async function pushBatch(db: Db, opts: { baseDir: string; batchId: string }) {
  const id = batchIdSchema.safeParse(opts.batchId);
  if (!id.success) throw new EvalValidationError([`invalid batch id "${opts.batchId}"`]);
  const dir = path.join(opts.baseDir, id.data);
  const manifestPath = path.join(dir, "manifest.json");
  const resultsPath = path.join(dir, "results.json");
  if (!existsSync(manifestPath)) throw new EvalValidationError([`${manifestPath} not found — run eval:pull first`]);
  if (!existsSync(resultsPath)) throw new EvalValidationError([`${resultsPath} not found`]);

  const readJson = (p: string) => {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as unknown;
    } catch (e) {
      throw new EvalValidationError([`${p}: invalid JSON (${(e as Error).message})`]);
    }
  };
  const manifest = manifestSchema.safeParse(readJson(manifestPath));
  if (!manifest.success) throw new EvalValidationError(formatZodIssues(manifest.error).map((m) => `manifest ${m}`));
  const results = resultsSchema.safeParse(readJson(resultsPath));
  if (!results.success) throw new EvalValidationError(formatZodIssues(results.error));

  const { errors, planned } = validateResults(manifest.data, results.data);
  if (errors.length) throw new EvalValidationError(errors);

  const outcomes: { submission_id: string; outcome: PushOutcome }[] = [];
  for (const p of planned) {
    const { data: sub, error: subErr } = await db
      .from("submissions")
      .select("status")
      .eq("id", p.submission_id)
      .maybeSingle();
    if (subErr || !sub) throw new Error(`submission ${p.submission_id}: ${subErr?.message ?? "not found"}`);
    if (sub.status === "published" || sub.status === "needs_resubmission") {
      outcomes.push({ submission_id: p.submission_id, outcome: "skipped_reviewed" });
      continue;
    }

    const row = {
      submission_id: p.submission_id,
      batch_id: id.data,
      criteria: p.criteria,
      total: p.total,
      feedback: p.feedback,
      confidence: p.confidence,
      flags: p.flags,
      model: results.data.model,
    };
    const { data: existing } = await db
      .from("evaluations")
      .select("criteria,total,feedback,confidence,flags,model,approved_at")
      .eq("submission_id", p.submission_id)
      .eq("batch_id", id.data)
      .maybeSingle();
    let outcome: PushOutcome;
    if (existing?.approved_at) {
      outcomes.push({ submission_id: p.submission_id, outcome: "skipped_reviewed" });
      continue;
    } else if (
      existing &&
      canonicalJson({ ...existing, approved_at: undefined, total: Number(existing.total) }) ===
        canonicalJson({ ...row, submission_id: undefined, batch_id: undefined })
    ) {
      outcome = "unchanged";
    } else {
      const { error } = await db.from("evaluations").upsert(row, { onConflict: "submission_id,batch_id" });
      if (error) throw new Error(`evaluation for ${p.submission_id}: ${error.message}`);
      outcome = existing ? "updated" : "inserted";
    }

    // Only the newest batch for a submission may set its score (re-pushing an old batch can't win).
    const { data: newest } = await db
      .from("evaluations")
      .select("batch_id")
      .eq("submission_id", p.submission_id)
      .order("batch_id", { ascending: false })
      .limit(1)
      .single();
    if (newest?.batch_id !== id.data) {
      outcomes.push({ submission_id: p.submission_id, outcome: "skipped_superseded" });
      continue;
    }

    const { error: upErr } = await db
      .from("submissions")
      .update({ status: "ai_reviewed", final_score: p.final_score, feedback: p.feedback })
      .eq("id", p.submission_id)
      .in("status", ["submitted", "ai_reviewed"]);
    if (upErr) throw new Error(`submission ${p.submission_id}: ${upErr.message}`);
    outcomes.push({ submission_id: p.submission_id, outcome });
  }

  const missing = manifest.data.submissions
    .map((s) => s.submission_id)
    .filter((sid) => !planned.some((p) => p.submission_id === sid));
  return { batchId: id.data, outcomes, missing };
}
