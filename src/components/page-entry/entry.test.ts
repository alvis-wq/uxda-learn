import { describe, expect, it } from "vitest";
import { ENTRY, entryDelay } from "./entry";

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
