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

const { submitFeedback } = await import("./feedback-actions");

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const inserts: Record<string, unknown>[] = [];

/** `visible` is what the user's own session can read: RLS returns the draft only to a tester who may see it. */
function setup(visible: { slug: string; status: string } | null, insertError: unknown = null) {
  inserts.length = 0;
  createClient.mockResolvedValue({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: visible, error: null }) }) }) }),
  });
  createAdminClient.mockReturnValue({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => (inserts.push({ table, ...row }), { error: insertError }),
    }),
  });
}

describe("submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue({ id: USER.id, is_tester: true });
  });

  it("saves a note from a tester on a draft they can see, as themselves", async () => {
    setup({ slug: "demo", status: "draft" });
    await expect(submitFeedback("demo", "  Question 2 has two right answers.  ")).resolves.toEqual({ ok: true });
    expect(inserts).toEqual([{ table: "challenge_feedback", challenge_slug: "demo", user_id: USER.id, body: "Question 2 has two right answers." }]);
  });

  it("needs a session", async () => {
    getCurrentUser.mockResolvedValue(null);
    getCurrentProfile.mockResolvedValue(null);
    await expect(submitFeedback("demo", "hi")).resolves.toMatchObject({ ok: false });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("is only for testers", async () => {
    getCurrentProfile.mockResolvedValue({ id: USER.id, is_tester: false });
    await expect(submitFeedback("demo", "hi")).resolves.toEqual({ ok: false, error: "Feedback is only for testers." });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("only on a draft the database lets them see: not a published one, not one they can't read", async () => {
    setup({ slug: "demo", status: "published" });
    await expect(submitFeedback("demo", "hi")).resolves.toMatchObject({ ok: false });
    setup(null);
    await expect(submitFeedback("demo", "hi")).resolves.toMatchObject({ ok: false });
    expect(inserts).toEqual([]);
  });

  it.each([["empty", ""], ["only spaces", "   \n "], ["too long", "x".repeat(2001)], ["not text", 42]])("rejects %s", async (_label, body) => {
    setup({ slug: "demo", status: "draft" });
    await expect(submitFeedback("demo", body)).resolves.toMatchObject({ ok: false });
    expect(inserts).toEqual([]);
  });

  it("accepts exactly 2000 characters", async () => {
    setup({ slug: "demo", status: "draft" });
    await expect(submitFeedback("demo", "x".repeat(2000))).resolves.toEqual({ ok: true });
  });

  it("rejects a malformed slug before any query", async () => {
    await expect(submitFeedback("../x", "hi")).resolves.toEqual({ ok: false, error: "Challenge not found." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    setup({ slug: "demo", status: "draft" }, { message: "boom" });
    await expect(submitFeedback("demo", "hi")).resolves.toEqual({ ok: false, error: "Couldn't send your feedback. Please try again." });
  });
});
