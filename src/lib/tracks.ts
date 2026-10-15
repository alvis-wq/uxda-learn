import type { Database } from "@/lib/database.types";

/**
 * Tracks and leaderboard groups — the one place to configure them.
 * Adding a track also needs a migration (`alter type track/audience add value`).
 * A track with `selectable: false` stays in the enum (old content, history and audit rows keep their label) but is
 * never offered in onboarding or Admin → Users, and isn't in any leaderboard group.
 */

export type Track = Database["public"]["Enums"]["track"];
/** A track, or `all` (everyone, including tracks added later). */
export type Audience = Database["public"]["Enums"]["audience"];

export const TRACKS = [
  { value: "strategist", label: "Strategist", description: "Research, structure, wireframes and flows.", selectable: true },
  { value: "designer", label: "Designer", description: "UI, design systems and Figma craft.", selectable: true },
  {
    value: "motion_designer",
    label: "Motion Designer",
    description: "Animation, transitions and motion systems.",
    selectable: true,
  },
  {
    value: "account_manager",
    label: "Account Manager",
    description: "Clients, projects, scope and delivery.",
    selectable: false,
  },
  {
    value: "assistant",
    label: "Marketing Assistant",
    description: "Operations, coordination and team support.",
    selectable: false,
  },
  { value: "management", label: "Management", description: "Founders, executives and assistants.", selectable: true },
] as const satisfies readonly { value: Track; label: string; description: string; selectable: boolean }[];

export const TRACK_VALUES = TRACKS.map((t) => t.value) as [Track, ...Track[]];

/** The tracks people can be put on (onboarding, Admin → Users). */
export const SELECTABLE_TRACKS = TRACKS.filter((t) => t.selectable);

export type SelectableTrack = (typeof SELECTABLE_TRACKS)[number]["value"];

export const SELECTABLE_TRACK_VALUES = SELECTABLE_TRACKS.map((t) => t.value) as [SelectableTrack, ...SelectableTrack[]];

export const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.value, t.label])) as Record<Track, string>;

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACK_VALUES as string[]).includes(value);
}

export function isSelectableTrack(value: unknown): value is SelectableTrack {
  return typeof value === "string" && (SELECTABLE_TRACK_VALUES as string[]).includes(value);
}

/** Leaderboard groups: every selectable track belongs to exactly one group, hidden ones to none (unit-tested). */
export const LEADERBOARD_GROUPS = [
  { id: "strategists", label: "Strategists", tracks: ["strategist"] },
  { id: "designers", label: "Designers", tracks: ["designer", "motion_designer"] },
  { id: "team", label: "Team", tracks: ["management"] },
] as const satisfies readonly { id: string; label: string; tracks: readonly Track[] }[];

export type LeaderboardGroup = (typeof LEADERBOARD_GROUPS)[number];

export function groupForTrack(track: Track | null | undefined): LeaderboardGroup | undefined {
  return LEADERBOARD_GROUPS.find((g) => (g.tracks as readonly Track[]).includes(track as Track));
}

export function groupById(id: unknown): LeaderboardGroup | undefined {
  return LEADERBOARD_GROUPS.find((g) => g.id === id);
}

/** The tracks an audience list covers. `all` = every track. */
export function audienceTracks(audiences: readonly Audience[]): Track[] {
  if (audiences.includes("all")) return [...TRACK_VALUES];
  return TRACK_VALUES.filter((t) => audiences.includes(t));
}

/** Users see audience `all` plus anything that lists their track. */
export function isVisibleToTrack(audiences: readonly Audience[], track: Track | null | undefined): boolean {
  return audiences.includes("all") || (!!track && audiences.includes(track));
}

/** An audience list that names only tracks nobody can be put on any more (so nobody new will ever see it). */
export function onlyHiddenTracks(audiences: readonly Audience[]): boolean {
  return audiences.length > 0 && !audiences.includes("all") && audiences.every((a) => !isSelectableTrack(a));
}

/** Human label for an audience list, e.g. "Designer, Motion Designer" or "Everyone". */
export function audienceLabel(audiences: readonly Audience[]): string {
  if (audiences.includes("all")) return "Everyone";
  return audiences.map((a) => TRACK_LABEL[a as Track] ?? a).join(", ");
}

/** Tracks that can see something gated by every one of these audience lists (category ∩ challenge). */
export function visibleTracks(...lists: readonly (readonly Audience[])[]): Track[] {
  return TRACK_VALUES.filter((t) => lists.every((a) => isVisibleToTrack(a, t)));
}

/** `required_for` uses the same shape as audiences; an empty list means optional for everyone. */
export function isRequiredFor(requiredFor: readonly Audience[], track: Track | null | undefined): boolean {
  return requiredFor.length > 0 && isVisibleToTrack(requiredFor, track);
}
