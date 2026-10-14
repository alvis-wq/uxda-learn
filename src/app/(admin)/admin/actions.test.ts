import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminOrNull = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/auth/admin", () => ({ getAdminOrNull }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setUserTester } = await import("./actions");

const ADMIN = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const USER = "11111111-1111-4111-8111-111111111111";
const rpc = vi.fn();

describe("setUserTester", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("calls set_user_tester with the admin as the actor, so the audit row names them", async () => {
    await expect(setUserTester(USER, true)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_user_tester", { p_user: USER, p_value: true, p_actor: ADMIN.id });
  });

  it("can switch it off again", async () => {
    await setUserTester(USER, false);
    expect(rpc).toHaveBeenCalledWith("set_user_tester", { p_user: USER, p_value: false, p_actor: ADMIN.id });
  });

  it("is for admins only and touches nothing otherwise", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(setUserTester(USER, true)).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([["not a uuid", "nope", true], ["not a boolean", USER, "yes"]])("rejects input that is %s", async (_label, id, flag) => {
    await expect(setUserTester(id as string, flag as boolean)).resolves.toEqual({ ok: false, error: "Invalid input." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(setUserTester(USER, true)).resolves.toEqual({ ok: false, error: "Couldn't update tester access." });
  });
});
