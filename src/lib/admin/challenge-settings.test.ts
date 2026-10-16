import { describe, expect, it } from "vitest";
import { TRACK_VALUES } from "@/lib/tracks";
import {
  defaultFeaturedFor,
  describeAudit,
  featuredMoveSchema,
  pathSettingChangeError,
  pathSettingChangeSchema,
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
      /^Can't require it for everyone: Strategist, Account Manager, Marketing Assistant, Management can't see this challenge/,
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

describe("path settings (required_for, due_at)", () => {
  it("accepts the same shapes as a challenge's, and nothing else", () => {
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "required_for", value: ["designer"] }).success).toBe(true);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "required_for", value: [] }).success).toBe(true);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "due_at", value: "2026-12-01T17:00:00Z" }).success).toBe(true);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "due_at", value: null }).success).toBe(true);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "status", value: "published" }).success).toBe(false);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "required_for", value: ["all", "designer"] }).success).toBe(false);
    expect(pathSettingChangeSchema.safeParse({ slug: "p", field: "due_at", value: "soon" }).success).toBe(false);
  });

  it("only allows tracks that can see the path", () => {
    const path = { audiences: ["designer" as const] };
    const category = { audiences: ["all" as const] };
    const req = (value: ("all" | "designer" | "strategist")[]) => ({ slug: "p", field: "required_for" as const, value });
    expect(pathSettingChangeError(req(["designer"]), path, category)).toBeNull();
    expect(pathSettingChangeError(req([]), path, category)).toBeNull();
    expect(pathSettingChangeError(req(["strategist"]), path, category)).toMatch(/Strategist: they can't see this path/);
    expect(pathSettingChangeError(req(["all"]), path, category)).toMatch(/^Can't require it for everyone/);
    expect(pathSettingChangeError(req(["designer"]), path, null)).toBe("This path's category is missing.");
    expect(pathSettingChangeError({ slug: "p", field: "due_at", value: null }, path, null)).toBeNull();
  });
});

describe("featuring (featured_for)", () => {
  const feature = (value: string[]) => settingChangeSchema.parse({ slug: "spot-the-plant", field: "featured_for", value });

  it("takes the same shape as required_for", () => {
    expect(settingChangeSchema.safeParse({ slug: "a", field: "featured_for", value: ["all", "designer"] }).success).toBe(false);
    expect(settingChangeSchema.safeParse({ slug: "a", field: "featured_for", value: ["designer", "designer"] }).success).toBe(false);
    expect(pathSettingChangeSchema.safeParse({ slug: "a", field: "featured_for", value: [] }).success).toBe(true);
  });

  it("only for tracks that can see it; turning it off is always fine", () => {
    expect(settingChangeError(feature(["designer"]), ctx())).toBeNull();
    expect(settingChangeError(feature(["strategist"]), ctx())).toBe(
      "Can't feature it for Strategist: they can't see this challenge (check the audiences of the challenge and its category).",
    );
    expect(settingChangeError(feature(["all"]), ctx())).toMatch(/^Can't feature it for everyone: .*Pick the tracks instead\.$/);
    expect(settingChangeError(feature([]), ctx({ audiences: ["strategist"] }, { audiences: ["designer"] }))).toBeNull();
  });

  it("never a milestone on its own", () => {
    expect(settingChangeError(feature(["designer"]), ctx({ path_slug: "alh" }))).toBe(
      "A path milestone can't be featured on its own. Feature its path instead.",
    );
    expect(settingChangeError(feature([]), ctx({ path_slug: "alh" }))).toBeNull();
  });

  it("a path: only for tracks that can see it", () => {
    const change = pathSettingChangeSchema.parse({ slug: "alh", field: "featured_for", value: ["designer"] });
    expect(pathSettingChangeError(change, { audiences: ["strategist"] }, { audiences: ["all"] })).toBe(
      "Can't feature it for Designer: they can't see this path (check the audiences of the path and its category).",
    );
    expect(pathSettingChangeError(change, { audiences: ["designer"] }, { audiences: ["all"] })).toBeNull();
  });

  it("starts with everyone who can see it, leaving out tracks nobody can choose any more", () => {
    expect(defaultFeaturedFor([...TRACK_VALUES])).toEqual(["all"]);
    expect(defaultFeaturedFor(["designer", "account_manager", "motion_designer"])).toEqual(["designer", "motion_designer"]);
  });

  it("reads well in the history and toasts", () => {
    expect(formatSettingValue("featured_for", [])).toBe("Not featured");
    expect(formatSettingValue("featured_for", ["all"])).toBe("Everyone");
    const base = { id: 1, changed_at: "", actor: "Alvis", source: "admin" };
    expect(describeAudit({ ...base, field: "featured_for", old_value: [], new_value: ["designer"] }).change).toBe("Featured for: Not featured → Designer");
    expect(describeAudit({ ...base, field: "featured_order", old_value: 3, new_value: 2 }).change).toBe("Featured order: #3 → #2");
  });

  it("move: kind, slug and direction only", () => {
    expect(featuredMoveSchema.safeParse({ kind: "path", slug: "alh", direction: "up" }).success).toBe(true);
    expect(featuredMoveSchema.safeParse({ kind: "category", slug: "alh", direction: "up" }).success).toBe(false);
    expect(featuredMoveSchema.safeParse({ kind: "path", slug: "alh", direction: "left" }).success).toBe(false);
    expect(featuredMoveSchema.safeParse({ kind: "path", slug: "../x", direction: "up" }).success).toBe(false);
  });
});
