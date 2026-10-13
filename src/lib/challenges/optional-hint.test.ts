import { describe, expect, it } from "vitest";
import { optionalHint } from "./optional-hint";

describe("optionalHint", () => {
  it("with required challenges left: a count of the optional ones, in the categories above", () => {
    expect(optionalHint(2, 9)).toBe("9 more optional challenges in the categories above.");
    expect(optionalHint(1, 1)).toBe("1 more optional challenge in the categories above.");
  });

  it("hides the line when there are no optional ones (and required ones left)", () => {
    expect(optionalHint(3, 0)).toBe("");
  });

  it("with no required left: says so, and how many optional ones are waiting", () => {
    expect(optionalHint(0, 9)).toBe("All required done. 9 optional challenges are waiting in the categories.");
    expect(optionalHint(0, 1)).toBe("All required done. 1 optional challenge is waiting in the categories.");
    expect(optionalHint(0, 0)).toBe("All required done.");
  });
});
