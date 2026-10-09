import { describe, expect, it } from "vitest";
import {
  allowedEmailDomains,
  formatAllowedDomains,
  googleHostedDomainHint,
  isAllowedEmail,
  parseAllowedDomains,
  primaryEmailDomain,
} from "./domain";

const one = { ALLOWED_EMAIL_DOMAINS: "uxdesignagency.com" };
const two = { ALLOWED_EMAIL_DOMAINS: " UXDesignAgency.com, @theuxda.com;uxdesignagency.com " };

describe("parseAllowedDomains", () => {
  it("splits, lowercases, strips @ and dedupes", () => {
    expect(parseAllowedDomains(two.ALLOWED_EMAIL_DOMAINS)).toEqual(["uxdesignagency.com", "theuxda.com"]);
  });

  it("returns [] when empty", () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains(" , ")).toEqual([]);
  });

  it.each(["localhost", "-bad.com", "bad-.com", "a b.com", "x@y.com", "*.com", "evil.com/"])(
    "rejects %s",
    (value) => {
      expect(() => parseAllowedDomains(value)).toThrow(/invalid domain/);
    },
  );
});

describe("allowedEmailDomains", () => {
  it("throws when nothing is configured", () => {
    expect(() => allowedEmailDomains({})).toThrow(/ALLOWED_EMAIL_DOMAINS is not set/);
    expect(() => allowedEmailDomains({ ALLOWED_EMAIL_DOMAINS: "" })).toThrow(/not set/);
  });

  it("uses the first domain as primary", () => {
    expect(primaryEmailDomain(two)).toBe("uxdesignagency.com");
  });
});

describe("googleHostedDomainHint", () => {
  it("is the domain when there is one, * when there are several", () => {
    expect(googleHostedDomainHint(one)).toBe("uxdesignagency.com");
    expect(googleHostedDomainHint(two)).toBe("*");
  });
});

describe("formatAllowedDomains", () => {
  it("formats one, two and three domains", () => {
    expect(formatAllowedDomains(one)).toBe("@uxdesignagency.com");
    expect(formatAllowedDomains(two)).toBe("@uxdesignagency.com or @theuxda.com");
    expect(formatAllowedDomains({ ALLOWED_EMAIL_DOMAINS: "a.com,b.com,c.com" })).toBe("@a.com, @b.com or @c.com");
  });
});

describe("isAllowedEmail", () => {
  it("accepts only exact configured domains", () => {
    expect(isAllowedEmail("alvis@uxdesignagency.com", one)).toBe(true);
    expect(isAllowedEmail("Alvis@UXDesignAgency.com", one)).toBe(true);
    expect(isAllowedEmail("alvis@theuxda.com", one)).toBe(false);
    expect(isAllowedEmail("x@gmail.com", one)).toBe(false);
    expect(isAllowedEmail("x@uxdesignagency.com.evil.com", one)).toBe(false);
    expect(isAllowedEmail("x@sub.uxdesignagency.com", one)).toBe(false);
    expect(isAllowedEmail("uxdesignagency.com", one)).toBe(false);
    expect(isAllowedEmail("x@", one)).toBe(false);
    expect(isAllowedEmail(null, one)).toBe(false);
  });

  it("accepts any of several domains", () => {
    expect(isAllowedEmail("a@uxdesignagency.com", two)).toBe(true);
    expect(isAllowedEmail("a@theuxda.com", two)).toBe(true);
    expect(isAllowedEmail("a@example.com", two)).toBe(false);
  });

  it("fails closed when nothing is configured", () => {
    expect(() => isAllowedEmail("a@uxdesignagency.com", {})).toThrow();
  });
});
