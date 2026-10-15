import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import {
  audienceLabel,
  audienceTracks,
  groupById,
  groupForTrack,
  isRequiredFor,
  isSelectableTrack,
  isTrack,
  isVisibleToTrack,
  LEADERBOARD_GROUPS,
  onlyHiddenTracks,
  SELECTABLE_TRACK_VALUES,
  SELECTABLE_TRACKS,
  TRACK_LABEL,
  TRACKS,
  TRACK_VALUES,
  visibleTracks,
} from "./tracks";

describe("tracks", () => {
  it("match the database enum exactly", () => {
    expect([...TRACK_VALUES].sort()).toEqual([...Constants.public.Enums.track].sort());
    expect([...Constants.public.Enums.audience].sort()).toEqual(["all", ...TRACK_VALUES].sort());
  });

  it("include all six tracks", () => {
    expect([...TRACK_VALUES].sort()).toEqual(
      ["account_manager", "assistant", "designer", "management", "motion_designer", "strategist"].sort(),
    );
  });

  it("show the assistant track as Marketing Assistant (the value stays `assistant`)", () => {
    expect(TRACK_LABEL.assistant).toBe("Marketing Assistant");
    expect(isTrack("assistant")).toBe(true);
    expect(audienceLabel(["account_manager", "assistant"])).toBe("Account Manager, Marketing Assistant");
  });

  it("offer only Strategist, Designer, Motion Designer and Management", () => {
    expect(SELECTABLE_TRACKS.map((t) => t.label)).toEqual(["Strategist", "Designer", "Motion Designer", "Management"]);
    expect(SELECTABLE_TRACK_VALUES).toEqual(["strategist", "designer", "motion_designer", "management"]);
    expect(isSelectableTrack("account_manager")).toBe(false);
    expect(isSelectableTrack("assistant")).toBe(false);
    expect(isSelectableTrack("management")).toBe(true);
    expect(isSelectableTrack("all")).toBe(false);
  });

  it("describe Management as founders, executives and assistants", () => {
    expect(TRACKS.find((t) => t.value === "management")).toMatchObject({
      label: "Management",
      description: "Founders, executives and assistants.",
    });
  });

  it("isTrack only accepts known tracks", () => {
    expect(isTrack("motion_designer")).toBe(true);
    expect(isTrack("all")).toBe(false);
    expect(isTrack("admin")).toBe(false);
    expect(isTrack(undefined)).toBe(false);
  });
});

describe("leaderboard groups", () => {
  it("put every selectable track in exactly one group, and hidden tracks in none", () => {
    for (const t of TRACK_VALUES) {
      expect(LEADERBOARD_GROUPS.filter((g) => (g.tracks as readonly string[]).includes(t)), t).toHaveLength(
        isSelectableTrack(t) ? 1 : 0,
      );
    }
  });

  it("are Strategists / Designers (+ motion) / Team (management)", () => {
    expect(LEADERBOARD_GROUPS.map((g) => [g.id, g.label, [...g.tracks]])).toEqual([
      ["strategists", "Strategists", ["strategist"]],
      ["designers", "Designers", ["designer", "motion_designer"]],
      ["team", "Team", ["management"]],
    ]);
  });

  it("look up by track and by id", () => {
    expect(groupForTrack("motion_designer")?.id).toBe("designers");
    expect(groupForTrack("assistant")).toBeUndefined();
    expect(groupForTrack("management")?.id).toBe("team");
    expect(groupForTrack(null)).toBeUndefined();
    expect(groupById("team")?.label).toBe("Team");
    expect(groupById("nope")).toBeUndefined();
  });
});

describe("onlyHiddenTracks", () => {
  it("flags lists that name only tracks nobody can choose", () => {
    expect(onlyHiddenTracks(["assistant"])).toBe(true);
    expect(onlyHiddenTracks(["account_manager", "assistant"])).toBe(true);
  });

  it("is fine with all, a selectable track, or an empty list", () => {
    expect(onlyHiddenTracks(["all"])).toBe(false);
    expect(onlyHiddenTracks(["assistant", "management"])).toBe(false);
    expect(onlyHiddenTracks(["designer"])).toBe(false);
    expect(onlyHiddenTracks([])).toBe(false);
  });
});

describe("audiences", () => {
  it("all = every track, including later ones", () => {
    expect(audienceTracks(["all"])).toEqual(TRACK_VALUES);
    expect(audienceTracks(["designer", "motion_designer"])).toEqual(["designer", "motion_designer"]);
  });

  it("visibility", () => {
    expect(isVisibleToTrack(["all"], "assistant")).toBe(true);
    expect(isVisibleToTrack(["all"], "management")).toBe(true);
    expect(isVisibleToTrack(["designer"], "management")).toBe(false);
    expect(isVisibleToTrack(["designer", "motion_designer"], "motion_designer")).toBe(true);
    expect(isVisibleToTrack(["designer", "motion_designer"], "strategist")).toBe(false);
    expect(isVisibleToTrack(["designer"], null)).toBe(false);
  });

  it("visibleTracks intersects category and challenge audiences", () => {
    expect(visibleTracks(["designer", "motion_designer"], ["all"])).toEqual(["designer", "motion_designer"]);
    expect(visibleTracks(["all"], ["account_manager"])).toEqual(["account_manager"]);
    expect(visibleTracks(["strategist"], ["designer"])).toEqual([]);
  });

  it("required_for: empty = optional for everyone", () => {
    expect(isRequiredFor([], "designer")).toBe(false);
    expect(isRequiredFor(["all"], "assistant")).toBe(true);
    expect(isRequiredFor(["designer"], "motion_designer")).toBe(false);
  });

  it("labels", () => {
    expect(audienceLabel(["all"])).toBe("Everyone");
    expect(audienceLabel(["designer", "motion_designer"])).toBe("Designer, Motion Designer");
  });
});
