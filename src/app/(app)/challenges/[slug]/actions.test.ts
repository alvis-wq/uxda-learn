import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getCurrentUser, getCurrentProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { acknowledgeChallenge, submitChallenge } = await import("./actions");

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the supabase-js query builder used by the actions. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; row: Row; options: unknown }[] = [];
  const client = {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), builder),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), builder),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => ({ data: rows()[0] ?? null, error: rows()[0] ? null : { message: "none" } }),
        upsert: async (row: Row, options: unknown) => {
          writes.push({ table, row, options });
          const exists = (tables[table] ?? []).some(
            (r) => r.user_id === row.user_id && r.challenge_slug === row.challenge_slug,
          );
          if (!exists) (tables[table] ??= []).push({ ...row, acknowledged_at: "2026-10-09T10:00:00+00:00" });
          return { error: null };
        },
      };
      return builder;
    },
  };
  return { client, writes };
}

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const profile = (track: string | null, tester = false) => ({ id: USER.id, track, is_admin: false, is_tester: tester });

const ack = (over: Row = {}): Row => ({
  slug: "safety-rules",
  category_slug: "policies",
  type: "acknowledge",
  status: "published",
  audiences: ["all"],
  version: 3,
  ...over,
});

function setup(challenge: Row, category: Row = { slug: "policies", archived: false, audiences: ["all"] }) {
  const db = fakeDb({ challenges: [challenge], categories: [category], acknowledgements: [] });
  createAdminClient.mockReturnValue(db.client);
  return db;
}

describe("acknowledgeChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("designer"));
  });

  it("requires a session and never touches the DB without one", async () => {
    getCurrentUser.mockResolvedValue(null);
    getCurrentProfile.mockResolvedValue(null);
    await expect(acknowledgeChallenge("safety-rules")).resolves.toMatchObject({ ok: false });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("requires a track", async () => {
    getCurrentProfile.mockResolvedValue(profile(null));
    await expect(acknowledgeChallenge("safety-rules")).resolves.toEqual({ ok: false, error: "Choose your track first." });
  });

  it("rejects malformed slugs", async () => {
    await expect(acknowledgeChallenge("../x")).resolves.toEqual({ ok: false, error: "Challenge not found." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("records the session user, the challenge version and keeps it idempotent", async () => {
    const db = setup(ack());
    await expect(acknowledgeChallenge("safety-rules")).resolves.toEqual({
      ok: true,
      acknowledgedAt: "2026-10-09T10:00:00+00:00",
    });
    expect(db.writes).toEqual([
      {
        table: "acknowledgements",
        row: { user_id: USER.id, challenge_slug: "safety-rules", challenge_version: 3 },
        options: { onConflict: "user_id,challenge_slug", ignoreDuplicates: true },
      },
    ]);
    // A second confirm keeps the first timestamp.
    await expect(acknowledgeChallenge("safety-rules")).resolves.toMatchObject({
      acknowledgedAt: "2026-10-09T10:00:00+00:00",
    });
  });

  it.each([
    ["a non-acknowledge challenge", ack({ type: "quiz" }), undefined],
    ["a draft", ack({ status: "draft" }), undefined],
    ["a challenge for another track", ack({ audiences: ["strategist"] }), undefined],
    ["a challenge in another track's category", ack(), { slug: "policies", archived: false, audiences: ["strategist"] }],
    ["a challenge in an archived category", ack(), { slug: "policies", archived: true, audiences: ["all"] }],
  ])("refuses %s", async (_label, challenge, category) => {
    const db = setup(challenge, category);
    await expect(acknowledgeChallenge("safety-rules")).resolves.toEqual({
      ok: false,
      error: "This challenge can't be acknowledged.",
    });
    expect(db.writes).toEqual([]);
  });
});

describe("acknowledgeChallenge as a tester", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("designer", true));
  });

  it("cannot confirm a draft: nothing is recorded while testing", async () => {
    const db = setup(ack({ status: "draft" }));
    await expect(acknowledgeChallenge("safety-rules")).resolves.toEqual({ ok: false, error: "This challenge can't be acknowledged." });
    expect(db.writes).toEqual([]);
  });

  it("confirms a published one as usual", async () => {
    setup(ack());
    await expect(acknowledgeChallenge("safety-rules")).resolves.toMatchObject({ ok: true });
  });
});

describe("submitChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("designer"));
  });

  it("refuses submissions to acknowledge challenges", async () => {
    const db = setup(ack());
    await expect(
      submitChallenge("safety-rules", { answers: {}, imagePaths: [], figmaUrl: null, reflection: null }),
    ).resolves.toEqual({ ok: false, error: "This challenge isn't open for submissions." });
    expect(db.writes).toEqual([]);
  });
});

describe("submitChallenge on a path milestone", () => {
  const milestone = (slug: string, over: Row = {}): Row => ({
    slug, title: slug, category_slug: "wf", path_slug: "alh", type: "figma", status: "published", audiences: ["strategist"],
    difficulty: 2, points: 20, version: 1, questions: [], rubric: [],
    submission_spec: { figma_url: { required: true, label: "Link" } }, ...over,
  });
  const path = (over: Row = {}): Row => ({
    slug: "alh", title: "Auto Layout", category_slug: "wf", status: "published", audiences: ["strategist"],
    sequential: true, milestones: ["m1", "m2", "m3"], requires: [], ...over,
  });
  function setupPath(submissions: Row[], pathOver: Row = {}, extra: { paths?: Row[]; challenges?: Row[] } = {}) {
    const db = fakeDb({
      challenges: [milestone("m1"), milestone("m2"), milestone("m3"), ...(extra.challenges ?? [])],
      categories: [{ slug: "wf", title: "WF", archived: false, audiences: ["strategist"] }],
      paths: [path(pathOver), ...(extra.paths ?? [])],
      submissions,
      submission_drafts: [],
    });
    createAdminClient.mockReturnValue(db.client);
    return db;
  }
  const input = { answers: {}, imagePaths: [], figmaUrl: null, reflection: null };
  const sub = (slug: string, status: string): Row => ({
    user_id: USER.id, challenge_slug: slug, attempt: 1, status, final_score: null, max_score: 20, is_test: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("strategist"));
  });

  it("refuses a locked milestone (the one before has no attempt)", async () => {
    const db = setupPath([]);
    await expect(submitChallenge("m2", input)).resolves.toEqual({
      ok: false,
      error: "This milestone is locked. Submit milestone 1 first.",
    });
    expect(db.writes).toEqual([]);
  });

  it("opens the next milestone as soon as the previous one is awaiting review", async () => {
    setupPath([sub("m1", "submitted")]);
    // Past the lock: it gets as far as checking the form (no Figma link given).
    await expect(submitChallenge("m2", input)).resolves.toMatchObject({ ok: false, error: "Please fix the highlighted fields." });
    await expect(submitChallenge("m3", input)).resolves.toMatchObject({ error: "This milestone is locked. Submit milestone 2 first." });
  });

  it("never locks the first milestone", async () => {
    setupPath([]);
    await expect(submitChallenge("m1", input)).resolves.toMatchObject({ error: "Please fix the highlighted fields." });
  });

  describe("a path that requires another (path order)", () => {
    const first = (status = "published") => ({
      paths: [path({ slug: "first", title: "First path", milestones: ["f1", "f2"], status })],
      challenges: [milestone("f1", { path_slug: "first", status }), milestone("f2", { path_slug: "first", status })],
    });

    it("refuses every milestone until each milestone of the required path has an attempt", async () => {
      const db = setupPath([sub("f1", "published")], { requires: ["first"] }, first());
      for (const slug of ["m1", "m2"]) {
        await expect(submitChallenge(slug, input)).resolves.toEqual({
          ok: false,
          error: "This milestone is locked. Unlocks after First path.",
        });
      }
      expect(db.writes).toEqual([]);
    });

    it("opens once the required path is all submitted, awaiting review included", async () => {
      setupPath([sub("f1", "published"), sub("f2", "submitted")], { requires: ["first"] }, first());
      await expect(submitChallenge("m1", input)).resolves.toMatchObject({ error: "Please fix the highlighted fields." });
      // The milestone order inside the path still applies.
      await expect(submitChallenge("m2", input)).resolves.toMatchObject({ error: "This milestone is locked. Submit milestone 1 first." });
    });

    it("isn't held back by a required path the learner can't see", async () => {
      setupPath([], { requires: ["first"] }, first("archived"));
      await expect(submitChallenge("m1", input)).resolves.toMatchObject({ error: "Please fix the highlighted fields." });
    });

    it("counts a tester's test attempts on a draft required path, and only those", async () => {
      getCurrentProfile.mockResolvedValue(profile("strategist", true));
      const testSub = (slug: string) => ({ ...sub(slug, "published"), is_test: true });
      setupPath([sub("f1", "published"), sub("f2", "published")], { requires: ["first"], status: "draft" }, first("draft"));
      await expect(submitChallenge("m1", input)).resolves.toMatchObject({ error: "This milestone is locked. Unlocks after First path." });
      setupPath([testSub("f1"), testSub("f2")], { requires: ["first"], status: "draft" }, first("draft"));
      // Past the lock (m1 is a draft too, so the draft rules take over from here).
      await expect(submitChallenge("m1", input)).resolves.not.toMatchObject({ error: expect.stringContaining("locked") });
    });
  });

  it("refuses every milestone of a path the learner can't see", async () => {
    setupPath([], { status: "draft" });
    await expect(submitChallenge("m1", input)).resolves.toEqual({ ok: false, error: "This challenge isn't open for submissions." });
    setupPath([], { status: "archived" });
    await expect(submitChallenge("m1", input)).resolves.toEqual({ ok: false, error: "This challenge isn't open for submissions." });
  });
});
