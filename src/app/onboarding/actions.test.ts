import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const createAdminClient = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { chooseTrack } = await import("./actions");

const form = (track: string) => {
  const f = new FormData();
  f.set("track", track);
  return f;
};

describe("chooseTrack", () => {
  const update = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "u1" });
    const chain = { eq: () => chain, is: () => chain, select: async () => ({ data: [{ id: "u1" }], error: null }) };
    update.mockReturnValue(chain);
    createAdminClient.mockReturnValue({ from: () => ({ update }) });
  });

  it.each(["strategist", "designer", "motion_designer", "management"])("saves %s", async (track) => {
    await expect(chooseTrack({}, form(track))).rejects.toThrow("redirect:/");
    expect(update).toHaveBeenCalledWith({ track });
  });

  it.each(["account_manager", "assistant", "all"])("refuses %s, which isn't offered any more", async (track) => {
    await expect(chooseTrack({}, form(track))).resolves.toEqual({ error: "Choose your track." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
