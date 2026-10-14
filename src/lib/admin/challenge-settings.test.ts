import { describe, expect, it } from "vitest";
import {
  describeAudit,
  formatSettingValue,
  settingChangeError,
  settingChangeSchema,
  type SettingContext,
} from "./challenge-settings";

const ctx = (over: Partial<SettingContext["challenge"]> = {}, categoryAudiences: SettingContext["category"] = { audiences: ["all"] }, graderNotes: string | null = null): SettingContext => ({
  challenge: {
    slug: "spot-the-plant",
    title: "Spot the plant",
    summary: null,
    body_md: "Do the thing.",
    audiences: ["designer", "motion_designer"],
    questions: [],
    submission_spec: {},
    rubric: [],
    ...over,
  },
  category: categoryAudiences,
  graderNotes,
});

describe("settingChangeSchema", () => {
  it("accepts each field's valid values", () => {
    for (const change of [
      { slug: "a-b", field: "status", value: "published" },
      { slug: "a-b", field: "required_for", value: [] },
      { slug: "a-b", field: "required_for", value: ["all"] },
      { slug: "a-b", field: "required_for", value: ["designer", "strategist"] },
      { slug: "a-b", field: "due_at", value: "2026-11-01T17:00:00.000Z" },
      { slug: "a-b", field: "due_at", value: "2026-11-01T19:00:00+02:00" },
      { slug: "a-b", field: "due_at", value: null },
    ]) {
      expect(settingChangeSchema.safeParse(change).success, JSON.stringify(change)).toBe(true);
    }
  });

  it("rejects bad shapes, unknown fields and values the DB check would refuse", () => {
    for (const change of [
      { slug: "a-b", field: "status", value: "live" },
      { slug: "a-b", field: "points", value: 10 },
      { slug: "a-b", field: "required_for", value: ["all", "designer"] },
      { slug: "a-b", field: "required_for", value: ["designer", "designer"] },
      { slug: "a-b", field: "required_for", value: ["ceo"] },
      { slug: "a-b", field: "due_at", value: "next friday" },
      { slug: "a-b", field: "due_at", value: "2026-11-01T17:00:00" }, // no offset
      { slug: "Not A Slug", field: "status", value: "draft" },
      { slug: "a-b", field: "status", value: "draft", extra: true },
    ]) {
      expect(settingChangeSchema.safeParse(change).success, JSON.stringify(change)).toBe(false);
    }
  });
});

describe("settingChangeError", () => {
  it("allows required_for tracks that can see the challenge, and optional", () => {
    expect(settingChangeError({ slug: "x", field: "required_for", value: ["designer"] }, ctx())).toBeNull();
    expect(settingChangeError({ slug: "x", field: "required_for", value: [] }, ctx())).toBeNull();
  });

  it("refuses required_for tracks that can't see it (challenge audiences narrow the category)", () => {
    expect(settingChangeError({ slug: "x", field: "required_for", value: ["strategist", "designer"] }, ctx())).toBe(
      "Can't require it for Strategist: they can't see this challenge (check the audiences of the challenge and its category).",
    );
    // Visible to everyone on the challenge, but the category is strategist-only.
    expect(
      settingChangeError(
        { slug: "x", field: "required_for", value: ["designer"] },
        ctx({ audiences: ["all"] }, { audiences: ["strategist"] }),
      ),
    ).toMatch(/Can't require it for Designer/);
  });

  it("only allows required for everyone when every track can see it", () => {
    expect(settingChangeError({ slug: "x", field: "required_for", value: ["all"] }, ctx())).toMatch(
      /^Can't require it for everyone: Strategist, Account Manager, Assistant, Management can't see this challenge/,
    );
    expect(settingChangeError({ slug: "x", field: "required_for", value: ["all"] }, ctx({ audiences: ["all"] }))).toBeNull();
  });

  it("blocks publishing while any part of the content has a TODO placeholder", () => {
    const publish = { slug: "spot-the-plant", field: "status", value: "published" } as const;
    expect(settingChangeError(publish, ctx())).toBeNull();
    expect(settingChangeError(publish, ctx({ body_md: "Open TODO_FIGMA_URL first." }))).toBe(
      "Can't publish: the content still has placeholders — TODO_FIGMA_URL (brief). " +
        "Fill them in in content/challenges/spot-the-plant.md and run content:sync, then publish.",
    );
    // Private grader notes count too.
    expect(settingChangeError(publish, ctx({}, { audiences: ["all"] }, "Link: TODO_FIGMA_URL"))).toMatch(
      /TODO_FIGMA_URL \(grader notes\)/,
    );
    // Draft / archive stay possible.
    for (const value of ["draft", "archived"] as const) {
      expect(settingChangeError({ ...publish, value }, ctx({ body_md: "TODO_FIGMA_URL" }))).toBeNull();
    }
  });
});

describe("audit formatting", () => {
  it("formats each setting for people", () => {
    expect(formatSettingValue("status", "published")).toBe("Published");
    expect(formatSettingValue("required_for", [])).toBe("Optional");
    expect(formatSettingValue("required_for", ["all"])).toBe("Everyone");
    expect(formatSettingValue("required_for", ["designer", "motion_designer"])).toBe("Designer, Motion Designer");
    expect(formatSettingValue("due_at", null)).toBe("No due date");
    expect(formatSettingValue("due_at", "2026-11-01T17:00:00+00:00")).toMatch(/2026/);
  });

  it("describes who changed what", () => {
    const base = { id: 1, changed_at: "2026-10-09T10:00:00Z", actor: "Alvis" };
    expect(
      describeAudit({ ...base, field: "status", old_value: "draft", new_value: "published", source: "admin" }),
    ).toEqual({ change: "Status: Draft → Published", who: "Alvis" });
    expect(
      describeAudit({ ...base, field: "required_for", old_value: [], new_value: ["designer"], source: "admin", actor: null }),
    ).toEqual({ change: "Required for: Optional → Designer", who: "Former admin" });
    expect(
      describeAudit({ ...base, field: "status", old_value: "published", new_value: "archived", source: "content:sync", actor: null }).who,
    ).toBe("content:sync (file removed)");
  });
});
