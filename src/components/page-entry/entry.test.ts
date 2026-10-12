import { describe, expect, it } from "vitest";
import { ENTRY, entryDelay, nextEntryState, type EntryState } from "./entry";

describe("page entry timing", () => {
  it("staggers by ~35 ms", () => {
    expect(entryDelay(0)).toBe(0);
    expect(entryDelay(1)).toBeCloseTo(0.035);
    expect(entryDelay(2)).toBeCloseTo(0.07);
  });

  it("staggers at most 6 blocks, the rest appear together with the last", () => {
    const last = entryDelay(ENTRY.maxStaggered - 1);
    expect(last).toBeCloseTo(0.175);
    for (const i of [6, 7, 20, 200]) expect(entryDelay(i)).toBe(last);
  });

  it("never staggers with reduced motion", () => {
    for (const i of [0, 1, 5, 40]) expect(entryDelay(i, true)).toBe(0);
  });

  it("uses the specified motion", () => {
    expect(ENTRY).toMatchObject({ duration: 0.3, rise: 8, blur: 4, ease: [0.23, 1, 0.32, 1] });
    expect(ENTRY.reducedDuration).toBeLessThan(ENTRY.duration);
  });
});

describe("entry state (first load vs client navigation)", () => {
  const fresh: EntryState = { lastPath: undefined, clientNavigated: false };

  it("never plays on the first mount (hard load)", () => {
    const { state, play } = nextEntryState(fresh, "/");
    expect(play).toBe(false);
    expect(state).toEqual({ lastPath: "/", clientNavigated: false });
  });

  it("stays untouched after a hard load, so streamed-in content isn't animated mid-hydration", () => {
    const { state } = nextEntryState(fresh, "/");
    expect(state.clientNavigated).toBe(false); // MutationObserver arrivals are skipped while this is false
  });

  it("doesn't play for the same pathname again (StrictMode re-run, re-render, refresh)", () => {
    const first = nextEntryState(fresh, "/leaderboard").state;
    const again = nextEntryState(first, "/leaderboard");
    expect(again.play).toBe(false);
    expect(again.state).toBe(first);
  });

  it("plays on a route change and then allows late-arriving content to play", () => {
    const first = nextEntryState(fresh, "/").state;
    const nav = nextEntryState(first, "/leaderboard");
    expect(nav.play).toBe(true);
    expect(nav.state).toEqual({ lastPath: "/leaderboard", clientNavigated: true });
    // and it keeps playing for later navigations
    expect(nextEntryState(nav.state, "/profile").play).toBe(true);
  });
});
