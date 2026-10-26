import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminOrNull = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/auth/admin", () => ({ getAdminOrNull }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { setStaffTitle, setUserAcademyEditor, setUserLead, setUserTester, setUserTrack, updatePendingStaff } = await import("./actions");

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

describe("setUserLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("calls set_user_lead with the admin as the actor, so the audit row names them", async () => {
    await expect(setUserLead(USER, true)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_user_lead", { p_user: USER, p_value: true, p_actor: ADMIN.id });
  });

  it("can switch it off again", async () => {
    await setUserLead(USER, false);
    expect(rpc).toHaveBeenCalledWith("set_user_lead", { p_user: USER, p_value: false, p_actor: ADMIN.id });
  });

  it("is for admins only and touches nothing otherwise (a lead can't make leads)", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(setUserLead(USER, true)).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([["not a uuid", "nope", true], ["not a boolean", USER, "yes"]])("rejects input that is %s", async (_label, id, flag) => {
    await expect(setUserLead(id as string, flag as boolean)).resolves.toEqual({ ok: false, error: "Invalid input." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(setUserLead(USER, true)).resolves.toEqual({ ok: false, error: "Couldn't update lead access." });
  });
});

describe("setUserAcademyEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("calls set_user_academy_editor with the admin as the actor, so the audit row names them", async () => {
    await expect(setUserAcademyEditor(USER, true)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_user_academy_editor", { p_user: USER, p_value: true, p_actor: ADMIN.id });
  });

  it("is for admins only and touches nothing otherwise (an editor can't make editors)", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(setUserAcademyEditor(USER, true)).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([["not a uuid", "nope", true], ["not a boolean", USER, "yes"]])("rejects input that is %s", async (_label, id, flag) => {
    await expect(setUserAcademyEditor(id as string, flag as boolean)).resolves.toEqual({ ok: false, error: "Invalid input." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(setUserAcademyEditor(USER, true)).resolves.toEqual({ ok: false, error: "Couldn't update Academy editor access." });
  });
});

describe("setUserTrack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("goes through set_user_track with the admin as the actor, so staff_audit names them", async () => {
    await expect(setUserTrack(USER, "management")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_user_track", { p_user: USER, p_track: "management", p_actor: ADMIN.id });
  });

  it.each(["account_manager", "assistant", "all", "nope"])("refuses %s (not a track you can choose)", async (track) => {
    await expect(setUserTrack(USER, track)).resolves.toEqual({ ok: false, error: "Invalid input." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(setUserTrack(USER, "designer")).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(setUserTrack(USER, "designer")).resolves.toEqual({ ok: false, error: "Couldn't update the track." });
  });
});

describe("setStaffTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("saves a trimmed title for the lowercase email, as the admin (audited by set_staff_title)", async () => {
    await expect(setStaffTitle(" Ana@X.com ", "  Lead Designer ")).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_staff_title", {
      p_email: "ana@x.com",
      p_title: "Lead Designer",
      p_source: "admin",
      p_actor: ADMIN.id,
    });
  });

  it("an empty title removes it", async () => {
    await setStaffTitle("ana@x.com", "   ");
    expect(rpc).toHaveBeenCalledWith("set_staff_title", expect.objectContaining({ p_email: "ana@x.com", p_title: "" }));
  });

  it("rejects a bad email or a title over 80 characters", async () => {
    await expect(setStaffTitle("nope", "Designer")).resolves.toEqual({ ok: false, error: "Invalid input." });
    await expect(setStaffTitle("ana@x.com", "x".repeat(81))).resolves.toEqual({
      ok: false,
      error: "Keep it under 80 characters.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(setStaffTitle("ana@x.com", "Designer")).resolves.toEqual({ ok: false, error: "Only admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(setStaffTitle("ana@x.com", "Designer")).resolves.toEqual({ ok: false, error: "Couldn't save the title." });
  });
});

describe("updatePendingStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc });
    getAdminOrNull.mockResolvedValue(ADMIN);
  });

  it("fixes the email first, then saves the title under the new email", async () => {
    await expect(updatePendingStaff("ana@x.com", "Anna@X.com", "Designer")).resolves.toEqual({ ok: true });
    expect(rpc.mock.calls).toEqual([
      ["rename_staff_email", { p_old: "ana@x.com", p_new: "anna@x.com", p_actor: ADMIN.id }],
      ["set_staff_title", { p_email: "anna@x.com", p_title: "Designer", p_source: "admin", p_actor: ADMIN.id }],
    ]);
  });

  it("skips the rename when only the title changed", async () => {
    await updatePendingStaff("ana@x.com", "ana@x.com", "Lead Designer");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["set_staff_title"]);
  });

  it("says why a rename was refused, and saves nothing else", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "dup" } });
    await expect(updatePendingStaff("ana@x.com", "bob@x.com", "Designer")).resolves.toEqual({
      ok: false,
      error: "bob@x.com already has a title.",
    });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "signed in" } });
    await expect(updatePendingStaff("ana@x.com", "bob@x.com", "Designer")).resolves.toEqual({
      ok: false,
      error: "Someone has signed in with ana@x.com, so it can't be changed here.",
    });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["rename_staff_email", "rename_staff_email"]);
  });

  it("needs a valid email and a title (Remove is the way to clear one)", async () => {
    await expect(updatePendingStaff("ana@x.com", "nope", "Designer")).resolves.toEqual({
      ok: false,
      error: "Enter a valid email.",
    });
    await expect(updatePendingStaff("ana@x.com", "ana@x.com", " ")).resolves.toEqual({
      ok: false,
      error: "Enter a title, or remove the row.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is for admins only", async () => {
    getAdminOrNull.mockResolvedValue(null);
    await expect(updatePendingStaff("ana@x.com", "ana@x.com", "Designer")).resolves.toEqual({
      ok: false,
      error: "Only admins can do this.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
