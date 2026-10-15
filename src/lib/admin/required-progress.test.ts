import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import {
  buildAcknowledgementOverview,
  buildRequiredProgress,
  REQUIRED_CSV_HEADER,
  requiredProgressCsvRows,
  type ProgressChallenge,
  type ProgressInput,
  type ProgressPath,
} from "./required-progress";

const now = new Date("2026-10-09T12:00:00Z");
const past = "2026-10-01T09:00:00+00:00";

const people = {
  sam: { id: "u-sam", full_name: "Sam Strategist", email: "sam@x.com", track: "strategist" as const },
  dee: { id: "u-dee", full_name: "Dee Designer", email: "dee@x.com", track: "designer" as const },
  mo: { id: "u-mo", full_name: "Mo Motion", email: "mo@x.com", track: "motion_designer" as const },
  ana: { id: "u-ana", full_name: null, email: "ana@x.com", track: "assistant" as const },
  newbie: { id: "u-new", full_name: "No Track", email: "new@x.com", track: null },
};

const ch = (over: Partial<ProgressChallenge> & { slug: string }): ProgressChallenge => ({
  title: over.slug,
  category_slug: "all-cat",
  type: "quiz",
  status: "published",
  audiences: ["all"],
  required_for: [],
  due_at: null,
  ...over,
});

const input = (over: Partial<ProgressInput> = {}): ProgressInput => ({
  profiles: Object.values(people),
  categories: [
    { slug: "all-cat", archived: false, audiences: ["all"] },
    { slug: "design-cat", archived: false, audiences: ["designer", "motion_designer"] },
  ],
  challenges: [
    ch({ slug: "rules", type: "acknowledge", required_for: ["all"], due_at: past }),
    ch({ slug: "motion-quiz", category_slug: "design-cat", required_for: ["designer", "motion_designer"] }),
    ch({ slug: "optional-quiz" }),
  ],
  submissions: [],
  acknowledgements: [],
  now,
  ...over,
});

const sub = (user_id: string, challenge_slug: string, attempt: number, status: string, published_at: string | null = null) => ({
  user_id,
  challenge_slug,
  attempt,
  status: status as "published",
  final_score: status === "published" ? 5 : null,
  max_score: 10,
  published_at,
});

describe("buildRequiredProgress", () => {
  it("lists only onboarded users and only required challenges they can see", () => {
    const rows = buildRequiredProgress(input());
    expect(rows.map((r) => r.user.id)).toEqual(["u-sam", "u-dee", "u-mo", "u-ana"]);
    const items = Object.fromEntries(rows.map((r) => [r.user.id, r.items.map((i) => i.slug)]));
    expect(items["u-sam"]).toEqual(["rules"]);
    expect(items["u-mo"]).toEqual(["rules", "motion-quiz"]);
  });

  it("filters by track", () => {
    expect(buildRequiredProgress(input(), "motion_designer").map((r) => r.user.id)).toEqual(["u-mo"]);
  });

  it("derives done / pending / missing / overdue", () => {
    const rows = buildRequiredProgress(
      input({
        acknowledgements: [{ user_id: "u-dee", challenge_slug: "rules", acknowledged_at: "2026-09-30T08:00:00+00:00", challenge_version: 1 }],
        submissions: [
          sub("u-dee", "motion-quiz", 1, "published", "2026-10-02T10:00:00+00:00"),
          sub("u-mo", "motion-quiz", 1, "needs_resubmission"),
          sub("u-mo", "motion-quiz", 2, "submitted"),
        ],
      }),
    );
    const byUser = Object.fromEntries(rows.map((r) => [r.user.id, r]));
    const state = (u: string, slug: string) => byUser[u].items.find((i) => i.slug === slug);

    expect(state("u-dee", "rules")).toMatchObject({ state: "done", completedAt: "2026-09-30T08:00:00+00:00" });
    expect(state("u-dee", "motion-quiz")).toMatchObject({ state: "done", completedAt: "2026-10-02T10:00:00+00:00" });
    expect(state("u-mo", "motion-quiz")?.state).toBe("pending"); // latest attempt awaiting review
    expect(state("u-mo", "rules")?.state).toBe("overdue");
    expect(byUser["u-dee"].counts).toEqual({ done: 2, pending: 0, missing: 0, overdue: 0 });
    expect(byUser["u-mo"].counts).toEqual({ done: 0, pending: 1, missing: 0, overdue: 1 });
  });

  it("treats resubmission requested as missing (overdue after the due date)", () => {
    const rows = buildRequiredProgress(
      input({
        challenges: [
          ch({ slug: "undated", required_for: ["all"] }),
          ch({ slug: "late", required_for: ["all"], due_at: past }),
        ],
        submissions: [sub("u-sam", "undated", 1, "needs_resubmission"), sub("u-sam", "late", 1, "needs_resubmission")],
      }),
      "strategist",
    );
    expect(rows[0].items.map((i) => [i.slug, i.state])).toEqual([
      ["late", "overdue"],
      ["undated", "missing"],
    ]);
  });

  it("ignores drafts and archived categories", () => {
    const rows = buildRequiredProgress(
      input({
        categories: [{ slug: "all-cat", archived: true, audiences: ["all"] }],
        challenges: [ch({ slug: "x", required_for: ["all"] }), ch({ slug: "y", required_for: ["all"], status: "draft" })],
      }),
    );
    expect(rows.every((r) => r.items.length === 0)).toBe(true);
  });
});

describe("required progress CSV", () => {
  it("has one row per user and required challenge", () => {
    const rows = requiredProgressCsvRows(buildRequiredProgress(input(), "designer"));
    expect(REQUIRED_CSV_HEADER).toEqual([
      "name", "email", "track", "challenge_slug", "challenge_title", "state", "due_at", "completed_at", "item_type",
    ]);
    expect(rows).toEqual([
      ["Dee Designer", "dee@x.com", "Designer", "rules", "rules", "overdue", past, "", "challenge"],
      ["Dee Designer", "dee@x.com", "Designer", "motion-quiz", "motion-quiz", "missing", "", "", "challenge"],
    ]);
    expect(toCsv([REQUIRED_CSV_HEADER, ...rows]).split("\r\n")).toHaveLength(4);
  });
});

describe("buildAcknowledgementOverview", () => {
  it("lists who confirmed (with time and version) and who hasn't, among users who can see it", () => {
    const [overview, ...rest] = buildAcknowledgementOverview(
      input({
        challenges: [
          ch({ slug: "rules", type: "acknowledge" }),
          ch({ slug: "design-rules", type: "acknowledge", category_slug: "design-cat" }),
          ch({ slug: "draft-rules", type: "acknowledge", status: "draft" }),
          ch({ slug: "a-quiz" }),
        ],
        acknowledgements: [
          { user_id: "u-mo", challenge_slug: "rules", acknowledged_at: "2026-10-03T10:00:00+00:00", challenge_version: 2 },
          { user_id: "u-sam", challenge_slug: "rules", acknowledged_at: "2026-10-02T10:00:00+00:00", challenge_version: 1 },
        ],
      }),
    );
    expect(overview.challenge.slug).toBe("rules");
    expect(overview.acknowledged.map((a) => [a.user.id, a.at, a.version])).toEqual([
      ["u-sam", "2026-10-02T10:00:00+00:00", 1],
      ["u-mo", "2026-10-03T10:00:00+00:00", 2],
    ]);
    expect(overview.missing.map((p) => p.id)).toEqual(["u-dee", "u-ana"]); // no-track user excluded
    expect(rest.map((o) => o.challenge.slug)).toEqual(["design-rules"]);
    expect(rest[0].missing.map((p) => p.id)).toEqual(["u-dee", "u-mo"]);
  });
});

describe("required paths in Required progress", () => {
  const later = "2026-10-05T09:00:00+00:00";
  const path = (over: Partial<ProgressPath> = {}): ProgressPath => ({
    slug: "brand",
    title: "Brand the template",
    category_slug: "design-cat",
    status: "published",
    audiences: ["designer"],
    required_for: ["designer"],
    due_at: past,
    sequential: true,
    milestones: ["b1", "b2"],
    ...over,
  });
  const milestone = (slug: string) => ch({ slug, category_slug: "design-cat", audiences: ["designer"] });
  const withPath = (p: ProgressPath, submissions: ReturnType<typeof sub>[] = []) =>
    input({ challenges: [milestone("b1"), milestone("b2")], paths: [p], submissions });
  const pathItem = (rows: ReturnType<typeof buildRequiredProgress>) => rows[0].items.find((i) => i.kind === "path");

  it("is one item for the tracks it's required for, never its milestones", () => {
    const rows = buildRequiredProgress(withPath(path()), "designer");
    expect(rows[0].items.map((i) => [i.kind, i.slug])).toEqual([["path", "brand"]]);
    expect(pathItem(rows)).toMatchObject({ title: "Brand the template", type: null, due_at: past, state: "overdue" });
    expect(buildRequiredProgress(withPath(path()), "strategist")[0].items).toEqual([]); // can't see it
    expect(buildRequiredProgress(withPath(path({ required_for: [] })), "designer")[0].items).toEqual([]);
    expect(buildRequiredProgress(withPath(path({ status: "draft" })), "designer")[0].items).toEqual([]);
  });

  it("is done (completed when the last milestone first published) once every milestone has a published score", () => {
    const rows = buildRequiredProgress(
      withPath(path(), [sub(people.dee.id, "b1", 1, "published", past), sub(people.dee.id, "b2", 1, "published", later)]),
      "designer",
    );
    expect(pathItem(rows)).toMatchObject({ state: "done", completedAt: later });
    expect(rows[0].counts.done).toBe(1);
  });

  it("is pending when all are submitted and the rest await review, and not overdue then", () => {
    const rows = buildRequiredProgress(
      withPath(path(), [sub(people.dee.id, "b1", 1, "published", past), sub(people.dee.id, "b2", 1, "submitted")]),
      "designer",
    );
    expect(pathItem(rows)).toMatchObject({ state: "pending", completedAt: null });
  });

  it("goes in the CSV with item_type path", () => {
    const rows = requiredProgressCsvRows(buildRequiredProgress(withPath(path({ due_at: null })), "designer"));
    expect(rows).toEqual([["Dee Designer", "dee@x.com", "Designer", "brand", "Brand the template", "missing", "", "", "path"]]);
  });
});
