"use client";

import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSettingValue } from "@/lib/admin/challenge-settings";
import { TRACKS, TRACK_VALUES, type Audience, type Track } from "@/lib/tracks";
import { updateChallengeSetting, updatePathStatus } from "./actions";

type Props = {
  slug: string;
  title: string;
  status: string;
  requiredFor: Audience[];
  dueAt: string | null;
  visibleTracks: Track[];
  /** A path milestone: only its status is set here (never required or due on its own). */
  milestone?: boolean;
};

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** Status, required-for and due date for one challenge. Every change saves immediately. */
export function ChallengeSettingsControls(props: Props) {
  if (props.milestone) return <StatusSelect {...props} />;
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start lg:grid-cols-[auto_1fr_auto]">
      <StatusSelect {...props} />
      <RequiredForPicker {...props} />
      <DueDateInput {...props} />
    </div>
  );
}

function useSave(title: string) {
  const [pending, start] = useTransition();
  const save = (change: { slug: string } & ({ field: "status"; value: string } | { field: "required_for"; value: Audience[] } | { field: "due_at"; value: string | null }), onOptimistic: () => void) =>
    start(async () => {
      onOptimistic();
      const res = await updateChallengeSetting(change);
      if (!res.ok) toast.error(res.error);
      else {
        const label = { status: "Status", required_for: "Required for", due_at: "Due date" }[change.field];
        toast.success(`${label} saved for “${title}”: ${formatSettingValue(change.field, change.value)}.`);
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

function RequiredForPicker({ slug, title, requiredFor, visibleTracks }: Props) {
  const { pending, save } = useSave(title);
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
    <fieldset className="grid gap-1.5" aria-describedby={`required-hint-${slug}`}>
      <legend className="text-meta mb-1.5 font-medium">Required for</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <CheckOption
          id={`req-${slug}-all`}
          label="Everyone"
          checked={all}
          disabled={pending || !everyoneSees}
          title={everyoneSees ? "Required for every track, including tracks added later" : "Not every track can see this challenge"}
          onChange={(on) => commit(on ? ["all"] : [])}
        />
        {/* Hidden tracks only show while still ticked, so they can be cleared. */}
        {TRACKS.filter((t) => t.selectable || value.includes(t.value)).map((t) => {
          const canSee = visibleTracks.includes(t.value);
          return (
            <CheckOption
              key={t.value}
              id={`req-${slug}-${t.value}`}
              label={t.label}
              checked={all ? canSee : value.includes(t.value)}
              disabled={pending || all || !canSee}
              title={canSee ? undefined : `${t.label} can't see this challenge`}
              onChange={(on) => toggleTrack(t.value, on)}
            />
          );
        })}
      </div>
      <p id={`required-hint-${slug}`} className="text-muted-foreground text-meta">
        {value.length === 0 ? "Optional for everyone." : `Required for ${formatSettingValue("required_for", value)}.`}{" "}
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

function DueDateInput({ slug, title, dueAt }: Props) {
  const { pending, save } = useSave(title);
  const [value, setValue] = useOptimistic(dueAt);
  const [draft, setDraft] = useState<string | null>(null); // null = not being edited
  // Local time needs the browser's time zone, so render the value only after hydration.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const current = hydrated ? toLocalInput(value) : "";
  const shown = draft ?? current;
  const id = `due-${slug}`;

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
