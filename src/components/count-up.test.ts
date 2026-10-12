import { describe, expect, it } from "vitest";
import { formatPoints } from "./count-up";

describe("formatPoints", () => {
  it("prints whole numbers plainly, with a fixed locale so server and browser agree", () => {
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(128)).toBe("128");
    expect(formatPoints(1280)).toBe("1,280");
  });
  it("keeps one decimal for fractional scores", () => {
    expect(formatPoints(12.5)).toBe("12.5");
    expect(formatPoints(12.25)).toBe("12.3");
  });
});
