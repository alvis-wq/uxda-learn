import { z } from "zod";
import type { AttemptSummary } from "@/lib/submissions/rules";

/**
 * Importing path progress made before UXDA Learn (Admin → Users → a user → "Path progress", and
 * scripts/import-path-progress.ts). An import is stored as the user's next REAL attempt on a milestone, flagged
 * is_imported with who imported it, through import_submission() — which enforces every rule below again. These
 * helpers give the same answers up front, for the form and the script's dry run.
 */

export const DEFAULT_IMPORT_NOTE = "Completed before UXDA Learn";

/** done = a published attempt (counts at once); changes_requested = needs_resubmission (counts nothing yet). */
export const importOutcomeSchema = z.enum(["done", "changes_requested"]);
export type ImportOutcome = z.infer<typeof importOutcomeSchema>;

export const IMPORT_STATUS = { done: "published", changes_requested: "needs_resubmission" } as const;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const note = z.string().trim().max(2000, "Keep it under 2000 characters.");

export const importInputSchema = z
  .strictObject({
    userId: z.uuid(),
    slug,
    outcome: importOutcomeSchema,
    score: z.number({ error: "Enter a score." }).int("Whole points only.").min(0, "0 or more."),
    feedback: note,
  })
  .refine((v) => v.outcome === "done" || v.feedback.length > 0, {
    path: ["feedback"],
    message: "Say what needs to change.",
  });
export type ImportInput = z.infer<typeof importInputSchema>;

/** Why this milestone can't take an import now, or null. Mirrors import_submission() in the database. */
export function importBlocker(input: {
  pathStatus: string;
  milestoneStatus: string;
  points: number;
  score?: number;
  attempts: readonly AttemptSummary[];
}): string | null {
  if (input.pathStatus !== "published" || input.milestoneStatus !== "published") return "Publish the path first.";
  const sorted = [...input.attempts].sort((a, b) => b.attempt - a.attempt);
  const latest = sorted[0];
  if (latest && (latest.status === "submitted" || latest.status === "ai_reviewed")) return "An attempt is awaiting review.";
  if (sorted.length >= 3) return "All 3 attempts are used.";
  const best = Math.max(-1, ...sorted.filter((a) => a.status === "published" && a.final_score !== null).map((a) => Number(a.final_score)));
  if (best >= input.points) return "Already at full points.";
  if (input.score !== undefined && input.score > input.points) return `The score can be at most ${input.points}.`;
  return null;
}

/** The JSON file scripts/import-path-progress.ts reads (see data/auto-layout-import.json). */
export const importFileSchema = z.strictObject({
  path: slug,
  /** Feedback stored on each imported attempt, unless an entry has its own `note`. */
  note: note.default(DEFAULT_IMPORT_NOTE),
  users: z.array(
    z.strictObject({
      email: z.email().transform((e) => e.toLowerCase()),
      /** In path order, from milestone 1; fewer entries = the rest untouched. */
      milestones: z.array(
        z.strictObject({
          milestone: slug,
          status: importOutcomeSchema,
          score: z.number().int().min(0),
          note: note.optional(),
        }),
      ),
    }),
  ),
});
export type ImportFile = z.infer<typeof importFileSchema>;

export type ImportStep =
  | { kind: "import"; email: string; userId: string; slug: string; outcome: ImportOutcome; score: number; feedback: string }
  | { kind: "skip"; email: string; slug?: string; reason: string };

/**
 * What the script would do: every entry becomes an import, or a skip with the reason. Running it twice changes
 * nothing, because a milestone that already has an imported attempt is skipped. Pure: the caller loads the rows.
 */
export function planImport(
  file: ImportFile,
  ctx: {
    path: { slug: string; status: string; milestones: string[] } | null;
    milestones: { slug: string; status: string; points: number }[];
    users: { id: string; email: string }[];
    /** Real attempts of these users on the path's milestones. */
    attempts: (AttemptSummary & { user_id: string; challenge_slug: string; is_imported: boolean })[];
  },
): { steps: ImportStep[]; errors: string[] } {
  const errors: string[] = [];
  const steps: ImportStep[] = [];
  if (!ctx.path) return { steps, errors: [`No path "${file.path}" in the database — run content:sync first.`] };
  const path = ctx.path;
  const points = new Map(ctx.milestones.map((m) => [m.slug, m]));

  for (const u of file.users) {
    u.milestones.forEach((m, i) => {
      if (path.milestones[i] !== m.milestone) {
        errors.push(`${u.email}: entry ${i + 1} is "${m.milestone}", but milestone ${i + 1} of the path is "${path.milestones[i] ?? "(none)"}".`);
      }
      const ms = points.get(m.milestone);
      if (ms && m.score > ms.points) errors.push(`${u.email}: ${m.milestone} score ${m.score} is more than its ${ms.points} points.`);
    });
  }
  const emails = file.users.map((u) => u.email);
  for (const e of emails.filter((e, i) => emails.indexOf(e) !== i)) errors.push(`${e} is listed twice.`);
  if (errors.length) return { steps, errors };

  for (const u of file.users) {
    const user = ctx.users.find((x) => x.email.toLowerCase() === u.email);
    if (!user) {
      steps.push({ kind: "skip", email: u.email, reason: u.milestones.length ? "hasn't signed in to UXDA Learn yet" : "nothing to import" });
      continue;
    }
    if (u.milestones.length === 0) {
      steps.push({ kind: "skip", email: u.email, reason: "nothing to import" });
      continue;
    }
    for (const m of u.milestones) {
      const ms = points.get(m.milestone)!;
      const attempts = ctx.attempts.filter((a) => a.user_id === user.id && a.challenge_slug === m.milestone);
      if (attempts.some((a) => a.is_imported)) {
        steps.push({ kind: "skip", email: u.email, slug: m.milestone, reason: "already imported" });
        continue;
      }
      const blocker = importBlocker({ pathStatus: path.status, milestoneStatus: ms.status, points: ms.points, score: m.score, attempts });
      if (blocker) {
        steps.push({ kind: "skip", email: u.email, slug: m.milestone, reason: blocker });
        continue;
      }
      steps.push({
        kind: "import",
        email: u.email,
        userId: user.id,
        slug: m.milestone,
        outcome: m.status,
        score: m.score,
        feedback: m.note ?? file.note,
      });
    }
  }
  return { steps, errors };
}
