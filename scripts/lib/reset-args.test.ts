import { describe, expect, it } from "vitest";
import { parseResetArgs } from "./reset-args";

const env = { ALLOWED_EMAIL_DOMAINS: "uxdesignagency.com" };

describe("parseResetArgs", () => {
  it("is a dry run by default, and always covers the three test users", () => {
    expect(parseResetArgs([], env)).toEqual({
      apply: false,
      emails: [],
      testEmails: ["test-strategist@uxdesignagency.com", "test-designer@uxdesignagency.com", "test-admin@uxdesignagency.com"],
    });
  });

  it("--apply turns the dry run off, anywhere in the arguments", () => {
    expect(parseResetArgs(["--apply", "a@uxdesignagency.com"], env).apply).toBe(true);
    expect(parseResetArgs(["a@uxdesignagency.com", "--apply"], env).apply).toBe(true);
  });

  it("lowercases and de-duplicates emails, and treats a test user named as an email as a test user", () => {
    const args = parseResetArgs(["Alice@UXDesignAgency.com", "alice@uxdesignagency.com", "test-designer@uxdesignagency.com"], env);
    expect(args.emails).toEqual(["alice@uxdesignagency.com"]);
  });

  it("refuses anything that is not one exact address, and unknown options", () => {
    for (const bad of ["alice", "*@uxdesignagency.com", "a@b", "a@b.com,c@d.com", "%@x.com"]) {
      expect(() => parseResetArgs([bad], env), bad).toThrow(/exact email/);
    }
    expect(() => parseResetArgs(["--all"], env)).toThrow(/Unknown option/);
  });

  it("accepts --test-project (handled by the env loader)", () => {
    expect(parseResetArgs(["--test-project"], env).emails).toEqual([]);
  });
});
