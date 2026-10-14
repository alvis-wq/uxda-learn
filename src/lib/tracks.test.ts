import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import {
  audienceLabel,
  audienceTracks,
  groupById,
  groupForTrack,
  isRequiredFor,
  isTrack,
  isVisibleToTrack,
  LEADERBOARD_GROUPS,
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

  it("isTrack only accepts known tracks", () => {
    expect(isTrack("motion_designer")).toBe(true);
    expect(isTrack("all")).toBe(false);
    expect(isTrack("admin")).toBe(false);
    expect(isTrack(undefined)).toBe(false);
  });
});

describe("leaderboard groups", () => {
  it("put every track in exactly one group", () => {
    for (const t of TRACK_VALUES) {
      expect(LEADERBOARD_GROUPS.filter((g) => (g.tracks as readonly string[]).includes(t)), t).toHaveLength(1);
    }
  });

  it("are Strategists / Designers (+ motion) / Team (AM + assistant + management)", () => {
    expect(LEADERBOARD_GROUPS.map((g) => [g.id, g.label, [...g.tracks]])).toEqual([
      ["strategists", "Strategists", ["strategist"]],
      ["designers", "Designers", ["designer", "motion_designer"]],
      ["team", "Team", ["account_manager", "assistant", "management"]],
    ]);
  });

  it("look up by track and by id", () => {
    expect(groupForTrack("motion_designer")?.id).toBe("designers");
    expect(groupForTrack("assistant")?.id).toBe("team");
    expect(groupForTrack("management")?.id).toBe("team");
    expect(groupForTrack(null)).toBeUndefined();
    expect(groupById("team")?.label).toBe("Team");
    expect(groupById("nope")).toBeUndefined();
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
