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
      const filters: [string, unknown][] = [];
      const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => (filters.push([k, v]), builder),
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
