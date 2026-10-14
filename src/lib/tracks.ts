import type { Database } from "@/lib/database.types";

/**
 * Tracks and leaderboard groups — the one place to configure them.
 * Adding a track also needs a migration (`alter type track/audience add value`).
 */

export type Track = Database["public"]["Enums"]["track"];
/** A track, or `all` (everyone, including tracks added later). */
export type Audience = Database["public"]["Enums"]["audience"];

export const TRACKS = [
  { value: "strategist", label: "Strategist", description: "Research, structure, wireframes and flows." },
  { value: "designer", label: "Designer", description: "UI, design systems and Figma craft." },
  { value: "motion_designer", label: "Motion Designer", description: "Animation, transitions and motion systems." },
  { value: "account_manager", label: "Account Manager", description: "Clients, projects, scope and delivery." },
  { value: "assistant", label: "Assistant", description: "Operations, coordination and team support." },
  { value: "management", label: "Management", description: "CEO and COO." },
] as const satisfies readonly { value: Track; label: string; description: string }[];

export const TRACK_VALUES = TRACKS.map((t) => t.value) as [Track, ...Track[]];

export const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.value, t.label])) as Record<Track, string>;

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACK_VALUES as string[]).includes(value);
}

/** Leaderboard groups: every track belongs to exactly one group (unit-tested). */
export const LEADERBOARD_GROUPS = [
  { id: "strategists", label: "Strategists", tracks: ["strategist"] },
  { id: "designers", label: "Designers", tracks: ["designer", "motion_designer"] },
  { id: "team", label: "Team", tracks: ["account_manager", "assistant", "management"] },
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
