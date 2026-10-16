"use client";

import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { defaultFeaturedFor, formatSettingValue, SETTING_LABEL } from "@/lib/admin/challenge-settings";
import { isSelectableTrack, TRACKS, TRACK_VALUES, type Audience, type Track } from "@/lib/tracks";
import { updateChallengeSetting, updatePathSetting, updatePathStatus } from "./actions";

type Props = {
  slug: string;
  title: string;
  status: string;
  requiredFor: Audience[];
  dueAt: string | null;
  /** Tracks it's featured for on the home page ([] = not featured). */
  featuredFor: Audience[];
  visibleTracks: Track[];
  /** A path milestone: only its status is set here (never required, due or featured on its own). */
  milestone?: boolean;
  /** What the controls set: a challenge (default) or a learning path (required_for and due_at only). */
  kind?: "challenge" | "path";
};

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** Status, required-for, due date and featuring for one challenge. Every change saves immediately. */
export function ChallengeSettingsControls(props: Props) {
  if (props.milestone) {
    return (
      <div className="grid gap-2">
        <StatusSelect {...props} />
        <p className="text-muted-foreground text-meta" data-testid="milestone-feature-note">
          A milestone can&apos;t be featured on its own: feature its path instead.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start lg:grid-cols-[auto_1fr_auto]">
        <StatusSelect {...props} />
        <RequiredForPicker {...props} />
        <DueDateInput {...props} />
      </div>
      <FeaturedPicker {...props} />
    </div>
  );
}

function useSave(title: string, kind: Props["kind"] = "challenge") {
  const [pending, start] = useTransition();
  const save = (
    change: { slug: string } & (
      | { field: "status"; value: string }
      | { field: "required_for"; value: Audience[] }
      | { field: "due_at"; value: string | null }
      | { field: "featured_for"; value: Audience[] }
    ),
    onOptimistic: () => void,
  ) =>
    start(async () => {
      onOptimistic();
      // A path's status has its own control (PathStatusSelect): here a path only sets required_for and due_at.
      const res = kind === "path" && change.field !== "status" ? await updatePathSetting(change) : await updateChallengeSetting(change);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`${SETTING_LABEL[change.field]} saved for “${title}”: ${formatSettingValue(change.field, change.value)}.`);
      }
    });
  return { pending, save };
}

function StatusSelect({ slug, title, status }: Props) {
  const { pending, save } = useSave(title);
  const [value, setValue] = useOptimistic(status);
  const id = `status-${slug}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-meta">
        Status
      </Label>
      <Select
        value={value}
        disabled={pending}
        onValueChange={(next) => save({ slug, field: "status", value: next }, () => setValue(next))}
      >
        <SelectTrigger id={id} size="sm" className="w-36" aria-label={`Status of ${title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Element ids: a path's controls get their own prefix (a path and a challenge may share a slug). */
const idBase = (kind: Props["kind"], slug: string) => (kind === "path" ? `path-${slug}` : slug);

function RequiredForPicker({ slug, title, requiredFor, visibleTracks, kind }: Props) {
  const { pending, save } = useSave(title, kind);
  const noun = kind === "path" ? "path" : "challenge";
  const base = idBase(kind, slug);
  const [value, setValue] = useOptimistic(requiredFor);
  const all = value.includes("all");
  const everyoneSees = visibleTracks.length === TRACK_VALUES.length;

  const commit = (next: Audience[]) => save({ slug, field: "required_for", value: next }, () => setValue(next));
  const toggleTrack = (t: Track, on: boolean) => {
    const set = new Set(value.filter((a) => a !== "all"));
    if (on) set.add(t);
    else set.delete(t);
    commit(TRACK_VALUES.filter((v) => set.has(v)));
  };

  return (
    <fieldset className="grid gap-1.5" aria-describedby={`required-hint-${base}`}>
      <legend className="text-meta mb-1.5 font-medium">Required for</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <CheckOption
          id={`req-${base}-all`}
          label="Everyone"
          checked={all}
          disabled={pending || !everyoneSees}
          title={everyoneSees ? "Required for every track, including tracks added later" : `Not every track can see this ${noun}`}
          onChange={(on) => commit(on ? ["all"] : [])}
        />
        {/* Hidden tracks only show while still ticked, so they can be cleared. */}
        {TRACKS.filter((t) => t.selectable || value.includes(t.value)).map((t) => {
          const canSee = visibleTracks.includes(t.value);
          return (
            <CheckOption
              key={t.value}
              id={`req-${base}-${t.value}`}
              label={t.label}
              checked={all ? canSee : value.includes(t.value)}
              disabled={pending || all || !canSee}
              title={canSee ? undefined : `${t.label} can't see this ${noun}`}
              onChange={(on) => toggleTrack(t.value, on)}
            />
          );
        })}
      </div>
      <p id={`required-hint-${base}`} className="text-muted-foreground text-meta">
        {value.length === 0 ? "Optional for everyone." : `Required for ${formatSettingValue("required_for", value)}.`}{" "}
        Only tracks that can see it can be selected.
      </p>
    </fieldset>
  );
}

/**
 * "Feature on home": a switch, and the tracks it's featured for (like Required for: Everyone, or tracks that can see
 * it). On starts with everyone who can see it (defaultFeaturedFor); unticking the last track turns it off. Featured
 * items show in "Featured" at the top of those learners' home page, in the order of the list at the top of this page.
 */
function FeaturedPicker({ slug, title, featuredFor, visibleTracks, kind }: Props) {
  const { pending, save } = useSave(title, kind);
  const noun = kind === "path" ? "path" : "challenge";
  const base = idBase(kind, slug);
  const [value, setValue] = useOptimistic(featuredFor);
  const on = value.length > 0;
  const all = value.includes("all");
  const everyoneSees = visibleTracks.length === TRACK_VALUES.length;

  const commit = (next: Audience[]) => save({ slug, field: "featured_for", value: next }, () => setValue(next));
  const toggleTrack = (t: Track, checked: boolean) => {
    const set = new Set(value.filter((a) => a !== "all"));
    if (checked) set.add(t);
    else set.delete(t);
    commit(TRACK_VALUES.filter((v) => set.has(v)));
  };

  return (
    <fieldset className="grid gap-2" aria-describedby={`featured-hint-${base}`} data-testid="featured-picker">
      <legend className="sr-only">Featured on home</legend>
      <div className="flex items-center gap-2">
        <Switch
          id={`feat-${base}`}
          checked={on}
          disabled={pending || visibleTracks.length === 0}
          onCheckedChange={(next) => commit(next ? defaultFeaturedFor(visibleTracks) : [])}
        />
        <Label htmlFor={`feat-${base}`} className="text-meta font-medium">
          Feature on home
        </Label>
      </div>
      <div className="grid gap-1.5" role="group" aria-labelledby={`featured-for-${base}`}>
        <p id={`featured-for-${base}`} className="text-meta font-medium">
          Featured for
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <CheckOption
            id={`feat-${base}-all`}
            label="Everyone"
            checked={all}
            disabled={pending || !on || !everyoneSees}
            title={everyoneSees ? "Featured for every track, including tracks added later" : `Not every track can see this ${noun}`}
            // Unticking Everyone keeps it featured, for each offered track (untick from there).
            onChange={(checked) => commit(checked ? ["all"] : visibleTracks.filter(isSelectableTrack))}
          />
          {TRACKS.filter((t) => t.selectable || value.includes(t.value)).map((t) => {
            const canSee = visibleTracks.includes(t.value);
            return (
              <CheckOption
                key={t.value}
                id={`feat-${base}-${t.value}`}
                label={t.label}
                checked={all ? canSee : value.includes(t.value)}
                disabled={pending || !on || all || !canSee}
                title={canSee ? undefined : `${t.label} can't see this ${noun}`}
                onChange={(checked) => toggleTrack(t.value, checked)}
              />
            );
          })}
        </div>
      </div>
      <p id={`featured-hint-${base}`} className="text-muted-foreground text-meta">
        {on
          ? `Featured for ${formatSettingValue("featured_for", value)}: at the top of their home page until they complete it.`
          : "Not featured."}{" "}
        Only tracks that can see it can be selected.
      </p>
    </fieldset>
  );
}

function CheckOption({
  id,
  label,
  checked,
  disabled,
  title,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  title?: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2" title={title}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-meta font-normal peer-disabled:opacity-60">
        {label}
      </Label>
    </div>
  );
}

const subscribeNothing = () => () => {};

/** ISO → "2026-11-01T18:00" in the browser's time zone, for <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DueDateInput({ slug, title, dueAt, kind }: Props) {
  const { pending, save } = useSave(title, kind);
  const [value, setValue] = useOptimistic(dueAt);
  const [draft, setDraft] = useState<string | null>(null); // null = not being edited
  // Local time needs the browser's time zone, so render the value only after hydration.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const current = hydrated ? toLocalInput(value) : "";
  const shown = draft ?? current;
  const id = `due-${idBase(kind, slug)}`;

  const commit = (next: string | null) => {
    setDraft(null);
    if (next === value) return;
    save({ slug, field: "due_at", value: next }, () => setValue(next));
  };
  const commitDraft = () => {
    if (draft === null || draft === current) return setDraft(null);
    const date = draft ? new Date(draft) : null;
    if (date && Number.isNaN(date.getTime())) {
      toast.error("That date isn't valid.");
      return setDraft(null);
    }
    commit(date ? date.toISOString() : null);
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-meta">
        Due date
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="datetime-local"
          className="h-8 w-auto text-meta"
          value={shown}
          disabled={pending || !hydrated}
          aria-describedby={`${id}-tz`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setDraft(null);
          }}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => commit(null)}>
            Clear
          </Button>
        )}
      </div>
      <p id={`${id}-tz`} className="text-muted-foreground text-meta">
        {hydrated ? `Your time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Saves when you leave the field.` : " "}
      </p>
    </div>
  );
}

/**
 * A learning path's status. Publishing also publishes its draft milestones (the server checks for placeholders
 * first); every change is in the path's history, and each milestone's in its own.
 */
export function PathStatusSelect({ slug, title, status, draftMilestones }: { slug: string; title: string; status: string; draftMilestones: number }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(status);
  const id = `path-status-${slug}`;
  const change = (next: string) =>
    start(async () => {
      setValue(next);
      const res = await updatePathStatus({ slug, value: next });
      if (!res.ok) toast.error(res.error);
      else {
        const extra = next === "published" && draftMilestones > 0 ? ` and its ${draftMilestones} draft ${draftMilestones === 1 ? "milestone" : "milestones"}` : "";
        toast.success(`Status saved for “${title}”${extra}: ${formatSettingValue("status", next)}.`);
      }
    });
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-meta">
        Path status
      </Label>
      <Select value={value} disabled={pending} onValueChange={change}>
        <SelectTrigger id={id} size="sm" className="w-36" aria-label={`Status of the path ${title}`} aria-describedby={`${id}-hint`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={`${id}-hint`} className="text-muted-foreground text-meta">
        {draftMilestones > 0
          ? `Publishing also publishes its ${draftMilestones} draft ${draftMilestones === 1 ? "milestone" : "milestones"}.`
          : "All its milestones are already published or archived."}
      </p>
    </div>
  );
}

/**
 * A learning path's settings: status, required-for, due date and featuring, like a challenge's. A required path counts as one
 * required item; its milestones are never required on their own. Every change saves immediately and is audited.
 */
export function PathSettingsControls({
  slug,
  title,
  status,
  draftMilestones,
  requiredFor,
  dueAt,
  featuredFor,
  visibleTracks,
}: {
  slug: string;
  title: string;
  status: string;
  draftMilestones: number;
  requiredFor: Audience[];
  dueAt: string | null;
  featuredFor: Audience[];
  visibleTracks: Track[];
}) {
  const props: Props = { slug, title, status, requiredFor, dueAt, featuredFor, visibleTracks, kind: "path" };
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start lg:grid-cols-[auto_1fr_auto]">
        <PathStatusSelect slug={slug} title={title} status={status} draftMilestones={draftMilestones} />
        <RequiredForPicker {...props} />
        <DueDateInput {...props} />
      </div>
      <FeaturedPicker {...props} />
    </div>
  );
}
