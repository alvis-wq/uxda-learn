import { describe, expect, it } from "vitest";
import { cn, formatDate } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});

describe("cn with the custom text-meta size", () => {
  it("keeps a text colour next to text-meta", () => {
    expect(cn("text-muted-foreground", "text-meta")).toBe("text-muted-foreground text-meta");
  });

  it("still lets the last font size win", () => {
    expect(cn("text-sm", "text-meta")).toBe("text-meta");
  });
});

describe("formatDate", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("omits the year within the current year", () => {
    expect(formatDate("2026-10-12T12:00:00Z", now)).toBe("12 Oct");
  });
  it("shows the year otherwise", () => {
    expect(formatDate("2027-01-03T12:00:00Z", now)).toBe("3 Jan 2027");
  });
});
