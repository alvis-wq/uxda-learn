import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { notSignedIn, planStaffTitles, staffTitlesFileSchema, titleIndex } from "./staff-titles";

describe("data/staff-titles.json", () => {
  const file = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/staff-titles.json"), "utf8"));

  it("is valid: 24 people, lowercase emails, each once, none empty", () => {
    const parsed = staffTitlesFileSchema.safeParse(file);
    expect(parsed.success && parsed.data).toHaveLength(24);
    expect(file).toEqual(parsed.data); // already normalised: what's in the file is what gets written
  });

  it("has the titles as given", () => {
    const of = titleIndex(file);
    expect(of("alex@uxdesignagency.com")).toBe("Founder & CEO");
    expect(of("linda@uxdesignagency.com")).toBe("Co-founder / COO / CFO");
    expect(of("roberts.ceruss@uxdesignagency.com")).toBe("UX Strategist");
    expect(of("roberts@uxdesignagency.com")).toBe("UX/UI Designer");
    expect(of("agnese@uxdesignagency.com")).toBe("Marketing Assistant");
  });
});

describe("staffTitlesFileSchema", () => {
  it("lowercases and trims emails and titles", () => {
    expect(staffTitlesFileSchema.parse([{ email: " Ana@X.com ", job_title: " Designer " }])).toEqual([
      { email: "ana@x.com", job_title: "Designer" },
    ]);
  });

  it.each([
    ["a bad email", [{ email: "ana", job_title: "Designer" }]],
    ["an empty title", [{ email: "ana@x.com", job_title: "  " }]],
    ["a title over 80 characters", [{ email: "ana@x.com", job_title: "x".repeat(81) }]],
    ["an unknown key", [{ email: "ana@x.com", job_title: "Designer", track: "designer" }]],
    ["the same email twice (any case)", [{ email: "ana@x.com", job_title: "A" }, { email: "ANA@x.com", job_title: "B" }]],
  ])("rejects %s", (_label, rows) => {
    expect(staffTitlesFileSchema.safeParse(rows).success).toBe(false);
  });
});

describe("planStaffTitles", () => {
  it("adds new emails, changes different titles, skips equal ones and keeps the rest", () => {
    const plan = planStaffTitles(
      [
        { email: "new@x.com", job_title: "Designer" },
        { email: "moved@x.com", job_title: "Lead Designer" },
        { email: "same@x.com", job_title: "Strategist" },
      ],
      [
        { email: "moved@x.com", job_title: "Designer" },
        { email: "same@x.com", job_title: "Strategist" },
        { email: "other@x.com", job_title: "CEO" },
      ],
    );
    expect(plan).toEqual({
      add: [{ email: "new@x.com", job_title: "Designer" }],
      change: [{ email: "moved@x.com", job_title: "Lead Designer", old: "Designer" }],
      same: [{ email: "same@x.com", job_title: "Strategist" }],
      untouched: [{ email: "other@x.com", job_title: "CEO" }],
    });
  });

  it("running it again after applying changes nothing", () => {
    const wanted = [{ email: "a@x.com", job_title: "A" }];
    const plan = planStaffTitles(wanted, wanted);
    expect(plan.add).toEqual([]);
    expect(plan.change).toEqual([]);
  });
});

describe("titleIndex", () => {
  it("looks up by email without case, and gives nothing for no title or no email", () => {
    const of = titleIndex([{ email: "ana@x.com", job_title: "Designer" }]);
    expect(of("Ana@X.com")).toBe("Designer");
    expect(of("bob@x.com")).toBeUndefined();
    expect(of(null)).toBeUndefined();
  });
});

describe("notSignedIn", () => {
  it("lists titles whose email has no profile (any case), sorted by email", () => {
    const rows = [
      { email: "zed@x.com", job_title: "Z" },
      { email: "ana@x.com", job_title: "A" },
      { email: "bob@x.com", job_title: "B" },
    ];
    expect(notSignedIn(rows, ["Bob@X.com"])).toEqual([
      { email: "ana@x.com", job_title: "A" },
      { email: "zed@x.com", job_title: "Z" },
    ]);
    expect(notSignedIn(rows, ["ana@x.com", "bob@x.com", "zed@x.com"])).toEqual([]);
  });
});
