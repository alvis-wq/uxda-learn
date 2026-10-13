import { describe, expect, it } from "vitest";
import { cn, formatDate, timeAgo } from "./utils";

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

describe("timeAgo", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it("reads naturally at each scale", () => {
    expect(timeAgo(ago(20_000), now)).toBe("just now");
    expect(timeAgo(ago(60_000), now)).toBe("1 minute ago");
    expect(timeAgo(ago(5 * 60_000), now)).toBe("5 minutes ago");
    expect(timeAgo(ago(3 * 3600_000), now)).toBe("3 hours ago");
    expect(timeAgo(ago(26 * 3600_000), now)).toBe("1 day ago");
    expect(timeAgo(ago(4 * 86_400_000), now)).toBe("4 days ago");
  });
});
