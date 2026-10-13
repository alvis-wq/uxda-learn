import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
const createAdminClient = vi.fn();
const createClient = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser, getCurrentProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveDraft, discardDraft } = await import("./draft-actions");
const { submitChallenge } = await import("./actions");

type Row = Record<string, unknown>;
type Op = { table: string; op: "upsert" | "delete" | "insert"; row?: Row; options?: unknown; filters?: [string, unknown][] };

/** In-memory stand-in for the supabase-js builder: reads filter rows, writes are recorded in `ops`. */
function fakeDb(tables: Record<string, Row[]>, ops: Op[] = []) {
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      let pending: Op | null = null;
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => (filters.push([k, v]), builder),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => ({ data: pending?.op === "insert" ? { id: "sub-1", status: "published" } : (rows()[0] ?? null), error: null }),
        upsert: async (row: Row, options: unknown) => (ops.push({ table, op: "upsert", row, options }), { error: null }),
        insert: (row: Row) => ((pending = { table, op: "insert", row }), ops.push(pending), builder),
        delete: () => ((pending = { table, op: "delete", filters }), ops.push(pending), builder),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: rows(), error: null }),
      };
      return builder;
    },
    storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
  };
  return client;
}

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const profile = (track: string | null) => ({ id: USER.id, track, is_admin: false });

const quiz = (over: Row = {}): Row => ({
  slug: "demo",
  category_slug: "cat",
  type: "mixed",
  status: "published",
  audiences: ["all"],
  version: 3,
  points: 10,
  questions: [
    { id: "q1", kind: "single", prompt: "P", points: 5, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
    { id: "q2", kind: "text", prompt: "P", points: 5 },
  ],
  // a reflection makes it a stepped (mixed) challenge: Brief, Questions, Reflection, Review
  submission_spec: { reflection: { required: false, prompt: "Why?" } },
  rubric: [],
  ...over,
});

let ops: Op[];
let userOps: Op[];
function setup(challenge: Row, submissions: Row[] = [], category: Row = { slug: "cat", archived: false, audiences: ["all"] }) {
  ops = [];
  userOps = [];
  createAdminClient.mockReturnValue(
    fakeDb({ challenges: [challenge], categories: [category], submissions, challenge_keys: [{ challenge_slug: "demo", answer_key: { q1: "a" } }] }, ops),
  );
  createClient.mockResolvedValue(fakeDb({}, userOps));
}

const input = (over: Row = {}) => ({ version: 3, step: 2, answers: { q1: "a" }, imagePaths: [], figmaUrl: "", reflection: "", ...over });

describe("saveDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("designer"));
  });

  it("requires a session and touches nothing without one", async () => {
    getCurrentUser.mockResolvedValue(null);
    getCurrentProfile.mockResolvedValue(null);
    await expect(saveDraft("demo", input())).resolves.toMatchObject({ ok: false });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed slugs before any query", async () => {
    await expect(saveDraft("../x", input())).resolves.toEqual({ ok: false, error: "Challenge not found." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("saves under the session user, stamped with the server's version, through the user's own client", async () => {
    setup(quiz());
    const res = await saveDraft("demo", input({ answers: { q1: "a", q2: "half a" } }));
    expect(res).toMatchObject({ ok: true });
    expect(userOps).toHaveLength(1);
    expect(userOps[0]).toMatchObject({
      table: "submission_drafts",
      op: "upsert",
      options: { onConflict: "user_id,challenge_slug" },
      row: {
        user_id: USER.id,
        challenge_slug: "demo",
        challenge_version: 3,
        answers: { q1: "a", q2: "half a" },
        figma_url: null,
        reflection: null,
        image_paths: [],
        current_step: 2,
      },
    });
    // nothing is written with the service role
    expect(ops.filter((o) => o.table === "submission_drafts")).toEqual([]);
  });

  it("deletes the draft instead of storing an empty form", async () => {
    setup(quiz());
    await expect(saveDraft("demo", input({ answers: {}, step: 1 }))).resolves.toMatchObject({ ok: true });
    expect(userOps).toMatchObject([{ table: "submission_drafts", op: "delete" }]);
  });

  it("refuses a form rendered from an older version of the challenge", async () => {
    setup(quiz({ version: 4 }));
    await expect(saveDraft("demo", input({ version: 3 }))).resolves.toMatchObject({ ok: false, stale: true });
    expect(userOps).toEqual([]);
  });

  it.each([
    ["an answer to an unknown question", { answers: { zzz: "a" } }],
    ["an unknown option", { answers: { q1: "zzz" } }],
    ["a step past the last (4 steps)", { step: 5 }],
    ["a screenshot the challenge doesn't take", { imagePaths: ["x"] }],
  ])("refuses %s", async (_label, over) => {
    setup(quiz());
    await expect(saveDraft("demo", input(over))).resolves.toMatchObject({ ok: false });
    expect(userOps).toEqual([]);
  });

  it.each([
    ["an acknowledge challenge", quiz({ type: "acknowledge" })],
    ["a draft challenge", quiz({ status: "draft" })],
    ["a challenge for another track", quiz({ audiences: ["strategist"] })],
  ])("refuses %s", async (_label, challenge) => {
    setup(challenge);
    await expect(saveDraft("demo", input())).resolves.toMatchObject({ ok: false });
    expect(userOps).toEqual([]);
  });

  it("refuses when the learner can't submit any more (awaiting review)", async () => {
    setup(quiz(), [{ user_id: USER.id, challenge_slug: "demo", attempt: 1, status: "submitted", final_score: null, max_score: 10 }]);
    await expect(saveDraft("demo", input())).resolves.toEqual({ ok: false, error: "Your submission is awaiting review." });
    expect(userOps).toEqual([]);
  });
});

describe("discardDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
  });

  it("removes only the session user's draft for that challenge", async () => {
    setup(quiz());
    await expect(discardDraft("demo")).resolves.toEqual({ ok: true });
    expect(userOps).toMatchObject([
      { table: "submission_drafts", op: "delete", filters: [["user_id", USER.id], ["challenge_slug", "demo"]] },
    ]);
  });

  it("does nothing without a session or with a bad slug", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(discardDraft("demo")).resolves.toEqual({ ok: false });
    getCurrentUser.mockResolvedValue(USER);
    await expect(discardDraft("../x")).resolves.toEqual({ ok: false });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("submitChallenge and drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile("designer"));
  });

  it("deletes the draft after a successful submit", async () => {
    // all-auto-graded, so it publishes at once
    setup(quiz({ questions: [{ id: "q1", kind: "single", prompt: "P", points: 10, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }] }));
    const res = await submitChallenge("demo", { answers: { q1: "a" }, imagePaths: [], figmaUrl: null, reflection: null });
    expect(res).toMatchObject({ ok: true });
    expect(ops.at(-1)).toMatchObject({
      table: "submission_drafts",
      op: "delete",
      filters: [["user_id", USER.id], ["challenge_slug", "demo"]],
    });
  });

  it("keeps the draft when the submission is refused", async () => {
    setup(quiz());
    const res = await submitChallenge("demo", { answers: {}, imagePaths: [], figmaUrl: null, reflection: null });
    expect(res).toMatchObject({ ok: false });
    expect(ops.filter((o) => o.table === "submission_drafts")).toEqual([]);
  });
});
