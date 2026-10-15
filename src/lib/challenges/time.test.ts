import { describe, expect, it } from "vitest";
import { sumTimes, timeLine, timeOf, timeParts } from "./time";

describe("timeOf", () => {
  it("is null without an estimate", () => {
    expect(timeOf({ estimated_minutes: null })).toBeNull();
    expect(timeOf({ estimated_minutes: null, waiting_minutes: 5 })).toBeNull();
  });

  it("hands-on time is the total minus waiting", () => {
    expect(timeOf({ estimated_minutes: 20, waiting_minutes: 10 })).toEqual({ total: 20, waiting: 10, handsOn: 10 });
    expect(timeOf({ estimated_minutes: 20, waiting_minutes: null })).toEqual({ total: 20, waiting: 0, handsOn: 20 });
    expect(timeOf({ estimated_minutes: 20 })).toEqual({ total: 20, waiting: 0, handsOn: 20 });
  });

  it("never shows more waiting than the total, or negative hands-on time", () => {
    expect(timeOf({ estimated_minutes: 10, waiting_minutes: 15 })).toEqual({ total: 10, waiting: 10, handsOn: 0 });
  });
});

describe("sumTimes", () => {
  it("adds the known times and skips the unknown ones", () => {
    expect(
      sumTimes([timeOf({ estimated_minutes: 20, waiting_minutes: 10 }), null, timeOf({ estimated_minutes: 10, waiting_minutes: 0 })]),
    ).toEqual({ total: 30, waiting: 10, handsOn: 20 });
  });

  it("is null when nothing has an estimate", () => {
    expect(sumTimes([])).toBeNull();
    expect(sumTimes([null, null])).toBeNull();
  });
});

describe("timeLine", () => {
  it("splits hands-on and waiting time when there is waiting", () => {
    const t = timeOf({ estimated_minutes: 20, waiting_minutes: 10 })!;
    expect(timeParts(t)).toEqual(["~10 min hands-on", "~10 min waiting", "~20 min total"]);
    expect(timeLine(t)).toBe("~10 min hands-on · ~10 min waiting · ~20 min total");
  });

  it("is just the total without waiting", () => {
    expect(timeLine(timeOf({ estimated_minutes: 20, waiting_minutes: 0 })!)).toBe("~20 min");
    expect(timeLine(timeOf({ estimated_minutes: 20 })!)).toBe("~20 min");
  });
});
