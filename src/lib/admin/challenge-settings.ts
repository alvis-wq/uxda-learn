import { z } from "zod";
import { challengeParts, describePlaceholders, findPlaceholders } from "@/lib/content/placeholders";
import { challengeStatusSchema } from "@/lib/content/schema";
import type { SettingField } from "@/lib/content/transform";
import {
  audienceLabel,
  audienceTracks,
  isSelectableTrack,
  TRACK_LABEL,
  TRACK_VALUES,
  visibleTracks,
  type Audience,
  type Track,
} from "@/lib/tracks";
import { formatDateTime } from "@/lib/utils";

/**
 * Admin-owned challenge settings: status, required_for, due_at. Content files set them only on
 * creation; after that they change here (server action → set_challenge_setting → audit row).
 * featured_for (the home page's "Featured") is admin-only from the start: content files don't have it.
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
  z.strictObject({ slug, field: z.literal("featured_for"), value: requiredForSchema }),
]);
export type SettingChange = z.infer<typeof settingChangeSchema>;

/** Every field the settings audit logs can hold: the content-file settings, plus featuring (admin-only). */
export type AuditField = SettingField | "featured_for" | "featured_order";

/**
 * Tracks in `value` (["all"] or a list) that can't see the item, given its category's and its own audiences. Used for
 * required_for and featured_for: only tracks that can see something can be required to do it, or see it featured.
 */
function blindTracks(value: Audience[], category: { audiences: Audience[] }, own: Audience[]) {
  const visible = visibleTracks(category.audiences, own);
  return audienceTracks(value).filter((t) => !visible.includes(t));
}

export type SettingContext = {
  challenge: {
    slug: string;
    title: string;
    summary: string | null;
    body_md: string;
    tip?: string | null;
    help_link?: unknown;
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
      help_link: c.help_link,
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
    if (change.field === "featured_for" && change.value.length > 0) return "A path milestone can't be featured on its own. Feature its path instead.";
  }
  if (change.field === "featured_for" && change.value.length > 0) {
    if (!ctx.category) return "This challenge's category is missing.";
    const blind = blindTracks(change.value, ctx.category, ctx.challenge.audiences);
    if (blind.length) return featureBlindError(change.value, blind, "challenge");
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

/** "Can't feature it for Designer: they can't see this path…" */
function featureBlindError(value: Audience[], blind: Track[], noun: "challenge" | "path"): string {
  const who = blind.map((t) => TRACK_LABEL[t]).join(", ");
  return value.includes("all")
    ? `Can't feature it for everyone: ${who} can't see this ${noun}. Pick the tracks instead.`
    : `Can't feature it for ${who}: they can't see this ${noun} (check the audiences of the ${noun} and its category).`;
}

export const SETTING_LABEL: Record<AuditField, string> = {
  status: "Status",
  required_for: "Required for",
  due_at: "Due date",
  featured_for: "Featured for",
  featured_order: "Featured order",
};

/** Human form of a stored setting value (audit log, toasts). */
export function formatSettingValue(field: AuditField, value: unknown): string {
  if (field === "featured_for") {
    const list = Array.isArray(value) ? (value as Audience[]) : [];
    return list.length ? audienceLabel(list) : "Not featured";
  }
  if (field === "featured_order") return typeof value === "number" ? `#${value}` : "—";
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

export function isSettingField(f: string): f is AuditField {
  return f in SETTING_LABEL;
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

/** A learning path's required_for or due_at change (Admin → Content → set_path_setting, audited). */
export const pathSettingChangeSchema = z.discriminatedUnion("field", [
  z.strictObject({ slug, field: z.literal("required_for"), value: requiredForSchema }),
  z.strictObject({ slug, field: z.literal("due_at"), value: z.iso.datetime({ offset: true }).nullable() }),
  z.strictObject({ slug, field: z.literal("featured_for"), value: requiredForSchema }),
]);
export type PathSettingChange = z.infer<typeof pathSettingChangeSchema>;

/**
 * Why a (schema-valid) path setting change isn't allowed, or null: required or featured only for tracks that can see
 * the path.
 */
export function pathSettingChangeError(
  change: PathSettingChange,
  path: { audiences: Audience[] },
  category: { audiences: Audience[] } | null,
): string | null {
  if (change.field === "featured_for" && change.value.length > 0) {
    if (!category) return "This path's category is missing.";
    const blind = blindTracks(change.value, category, path.audiences);
    return blind.length ? featureBlindError(change.value, blind, "path") : null;
  }
  if (change.field !== "required_for" || change.value.length === 0) return null;
  if (!category) return "This path's category is missing.";
  const visible = visibleTracks(category.audiences, path.audiences);
  const blind = audienceTracks(change.value).filter((t) => !visible.includes(t));
  if (!blind.length) return null;
  const who = blind.map((t) => TRACK_LABEL[t]).join(", ");
  return change.value.includes("all")
    ? `Can't require it for everyone: ${who} can't see this path. Pick the tracks instead.`
    : `Can't require it for ${who}: they can't see this path (check the audiences of the path and its category).`;
}

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

/** Move a featured challenge or path one place in the home page's "Featured" order (move_featured, audited). */
export const featuredMoveSchema = z.strictObject({
  kind: z.enum(["challenge", "path"]),
  slug,
  direction: z.enum(["up", "down"]),
});
export type FeaturedMove = z.infer<typeof featuredMoveSchema>;

/**
 * The value the "Feature on home" switch sets when turned on: everyone when every track can see the item, else the
 * offered tracks that can (unticked from there; tracks nobody can choose any more are left out). Off is [].
 */
export function defaultFeaturedFor(visible: readonly Track[]): Audience[] {
  return visible.length === TRACK_VALUES.length ? ["all"] : visible.filter(isSelectableTrack);
}
