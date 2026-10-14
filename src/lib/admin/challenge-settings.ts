import { z } from "zod";
import { challengeParts, describePlaceholders, findPlaceholders } from "@/lib/content/placeholders";
import { challengeStatusSchema } from "@/lib/content/schema";
import type { SettingField } from "@/lib/content/transform";
import {
  audienceLabel,
  audienceTracks,
  TRACK_LABEL,
  TRACK_VALUES,
  visibleTracks,
  type Audience,
} from "@/lib/tracks";
import { formatDateTime } from "@/lib/utils";

/**
 * Admin-owned challenge settings: status, required_for, due_at. Content files set them only on
 * creation; after that they change here (server action → set_challenge_setting → audit row).
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Empty = optional for everyone; otherwise ["all"] or distinct tracks (same rule as the DB check). */
export const requiredForSchema = z
  .array(z.enum(["all", ...TRACK_VALUES]))
  .refine((a) => !a.includes("all") || a.length === 1, '"All" can\'t be combined with tracks')
  .refine((a) => new Set(a).size === a.length, "lists a track twice");

export const settingChangeSchema = z.discriminatedUnion("field", [
  z.strictObject({ slug, field: z.literal("status"), value: challengeStatusSchema }),
  z.strictObject({ slug, field: z.literal("required_for"), value: requiredForSchema }),
  z.strictObject({ slug, field: z.literal("due_at"), value: z.iso.datetime({ offset: true }).nullable() }),
]);
export type SettingChange = z.infer<typeof settingChangeSchema>;

export type SettingContext = {
  challenge: {
    slug: string;
    title: string;
    summary: string | null;
    body_md: string;
    tip?: string | null;
    audiences: Audience[];
    questions: unknown;
    submission_spec: unknown;
    rubric: unknown;
    /** Set for a learning path's milestone: it is never required or due on its own. */
    path_slug?: string | null;
  };
  category: { audiences: Audience[] } | null;
  graderNotes: string | null;
};

/** Content placeholders (e.g. TODO_FIGMA_URL) in a challenge, public and private parts. */
export function challengePlaceholders(ctx: SettingContext) {
  const c = ctx.challenge;
  return findPlaceholders(
    challengeParts({
      title: c.title,
      summary: c.summary,
      body: c.body_md,
      tip: c.tip,
      questions: c.questions,
      submission: c.submission_spec,
      rubric: c.rubric,
      grader_notes: ctx.graderNotes,
    }),
  );
}

/** Why a (schema-valid) change isn't allowed for this challenge, or null when it is. */
export function settingChangeError(change: SettingChange, ctx: SettingContext): string | null {
  if (ctx.challenge.path_slug) {
    if (change.field === "required_for" && change.value.length > 0) return "A path milestone can't be required on its own.";
    if (change.field === "due_at" && change.value !== null) return "A path milestone can't have its own due date.";
  }
  if (change.field === "required_for" && change.value.length > 0) {
    if (!ctx.category) return "This challenge's category is missing.";
    const visible = visibleTracks(ctx.category.audiences, ctx.challenge.audiences);
    const blind = audienceTracks(change.value).filter((t) => !visible.includes(t));
    if (blind.length) {
      const who = blind.map((t) => TRACK_LABEL[t]).join(", ");
      return change.value.includes("all")
        ? `Can't require it for everyone: ${who} can't see this challenge. Pick the tracks instead.`
        : `Can't require it for ${who}: they can't see this challenge (check the audiences of the challenge and its category).`;
    }
  }
  if (change.field === "status" && change.value === "published") {
    const hits = challengePlaceholders(ctx);
    if (hits.length) {
      return (
        `Can't publish: the content still has placeholders — ${describePlaceholders(hits)}. ` +
        `Fill them in in content/challenges/${ctx.challenge.slug}.md and run content:sync, then publish.`
      );
    }
  }
  return null;
}

export const SETTING_LABEL: Record<SettingField, string> = {
  status: "Status",
  required_for: "Required for",
  due_at: "Due date",
};

/** Human form of a stored setting value (audit log, toasts). */
export function formatSettingValue(field: SettingField, value: unknown): string {
  if (field === "status") {
    const s = typeof value === "string" ? value : "";
    return s ? s[0].toUpperCase() + s.slice(1) : "—";
  }
  if (field === "required_for") {
    const list = Array.isArray(value) ? (value as Audience[]) : [];
    return list.length ? audienceLabel(list) : "Optional";
  }
  return typeof value === "string" && value ? formatDateTime(value) : "No due date";
}

export type AuditRow = {
  id: number;
  field: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  changed_at: string;
  actor: string | null; // admin's name or email
};

export function isSettingField(f: string): f is SettingField {
  return f === "status" || f === "required_for" || f === "due_at";
}

/** "Status: Draft → Published", by "Alvis" or "content:sync". */
export function describeAudit(row: AuditRow): { change: string; who: string } {
  const field = isSettingField(row.field) ? row.field : null;
  const change = field
    ? `${SETTING_LABEL[field]}: ${formatSettingValue(field, row.old_value)} → ${formatSettingValue(field, row.new_value)}`
    : `${row.field} changed`;
  const who = row.source === "content:sync" ? "content:sync (file removed)" : (row.actor ?? "Former admin");
  return { change, who };
}

/** A learning path's status change (Admin → Content). Publishing also publishes its draft milestones. */
export const pathStatusChangeSchema = z.strictObject({ slug, value: challengeStatusSchema });

/**
 * Why a path can't be published, or null: placeholders in the path itself or in any milestone that publishing would
 * publish (its drafts), and at least one milestone that isn't archived.
 */
export function pathPublishError(
  path: { slug: string; title: string; summary: string; before_you_start: string | null; before_you_submit: string[] },
  milestones: (SettingContext & { status: string })[],
): string | null {
  const own = findPlaceholders({
    title: path.title,
    summary: path.summary,
    "before you start": path.before_you_start,
    "before you submit": path.before_you_submit,
  });
  if (own.length) {
    return `Can't publish: the path still has placeholders — ${describePlaceholders(own)}. Fill them in in content/paths/${path.slug}.yaml and run content:sync.`;
  }
  if (!milestones.some((m) => m.status !== "archived")) return "Can't publish: the path has no milestones to show.";
  for (const m of milestones) {
    if (m.status !== "draft") continue;
    const hits = challengePlaceholders(m);
    if (hits.length) {
      return `Can't publish: milestone “${m.challenge.title}” still has placeholders — ${describePlaceholders(hits)}.`;
    }
  }
  return null;
}
