import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "./admin-emails";

describe("parseAdminEmails", () => {
  it("splits, trims, lowercases and dedupes", () => {
    expect(parseAdminEmails(" Alvis@theuxda.com, bob@theuxda.com;alvis@THEUXDA.com ")).toEqual([
      "alvis@theuxda.com",
      "bob@theuxda.com",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("  ")).toEqual([]);
  });

  it("rejects invalid emails", () => {
    expect(() => parseAdminEmails("not-an-email")).toThrow(/invalid email/);
  });
});
