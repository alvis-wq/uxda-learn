import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminOrNull = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/auth/admin", () => ({ getAdminOrNull }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { moveFeatured, updateChallengeSetting, updatePathSetting } = await import("./actions");

const ADMIN = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
type Row = Record<string, unknown>;

/** Reads by table (eq filters ignored: one row per table is enough here) and records every rpc call. */
function fakeDb(rows: Record<string, Row | null>, rpcResult: { data?: unknown; error: { code?: string } | null } = { data: true, error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const client = {
    rpc,
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return builder;
    },
  };
  createAdminClient.mockReturnValue(client);
  return rpc;
}

const challenge = (over: Row = {}): Row => ({
  slug: "spot-the-plant",
  title: "Spot the plant",
  summary: null,
  body_md: "Do it.",
  tip: null,
  help_link: null,
  audiences: ["designer"],
  questions: [],
  submission_spec: {},
  rubric: [],
  category_slug: "ui",
  path_slug: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getAdminOrNull.mockResolvedValue(ADMIN);
});

describe("featuring a challenge", () => {
  it("saves through set_challenge_setting with the admin as the actor (audited there)", async () => {
    const rpc = fakeDb({ challenges: challenge(), categories: { audiences: ["all"] }, challenge_keys: null });
    await expect(updateChallengeSetting({ slug: "spot-the-plant", field: "featured_for", value: ["designer"] })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_challenge_setting", {
      p_slug: "spot-the-plant",
      p_field: "featured_for",
      p_value: ["designer"],
      p_source: "admin",
      p_actor: ADMIN.id,
    });
  });

  it("refuses a milestone, and tracks that can't see it, without writing", async () => {
    let rpc = fakeDb({ challenges: challenge({ path_slug: "alh" }), categories: { audiences: ["all"] }, challenge_keys: null });
    await expect(updateChallengeSetting({ slug: "spot-the-plant", field: "featured_for", value: ["designer"] })).resolves.toEqual({
      ok: false,
      error: "A path milestone can't be featured on its own. Feature its path instead.",
    });
    expect(rpc).not.toHaveBeenCalled();
    rpc = fakeDb({ challenges: challenge(), categories: { audiences: ["all"] }, challenge_keys: null });
    await expect(updateChallengeSetting({ slug: "spot-the-plant", field: "featured_for", value: ["strategist"] })).resolves.toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(updateChallengeSetting({ slug: "spot-the-plant", field: "featured_for", value: [] })).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("featuring a path", () => {
  it("saves through set_path_setting", async () => {
    const rpc = fakeDb({ paths: { slug: "alh", audiences: ["strategist"], category_slug: "wf" }, categories: { audiences: ["all"] } });
    await expect(updatePathSetting({ slug: "alh", field: "featured_for", value: ["strategist"] })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_path_setting", expect.objectContaining({ p_field: "featured_for", p_value: ["strategist"], p_actor: ADMIN.id }));
  });
});

describe("moveFeatured", () => {
  it("calls move_featured with the admin as the actor", async () => {
    const rpc = fakeDb({});
    await expect(moveFeatured({ kind: "path", slug: "alh", direction: "up" })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("move_featured", { p_kind: "path", p_slug: "alh", p_direction: "up", p_actor: ADMIN.id });
  });

  it("says when the item isn't featured any more", async () => {
    fakeDb({}, { error: { code: "P0002" } });
    await expect(moveFeatured({ kind: "challenge", slug: "x", direction: "down" })).resolves.toEqual({
      ok: false,
      error: "That isn't featured any more. Reload the page.",
    });
  });

  it("is for admins only and rejects bad input, touching nothing", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(moveFeatured({ kind: "path", slug: "alh", direction: "up" })).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    getAdminOrNull.mockResolvedValue(ADMIN);
    await expect(moveFeatured({ kind: "path", slug: "alh", direction: "sideways" })).resolves.toEqual({ ok: false, error: "Invalid value." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
