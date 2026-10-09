import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { testLogin } = await import("./actions");

function form(role: string) {
  const fd = new FormData();
  fd.set("role", role);
  return fd;
}

describe("testLogin server action guard", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses in production even when ENABLE_TEST_LOGIN=true, without touching Supabase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TEST_LOGIN", "true");
    await expect(testLogin({}, form("admin"))).resolves.toEqual({ error: "Test login is disabled." });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses when ENABLE_TEST_LOGIN is not set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_TEST_LOGIN", "");
    await expect(testLogin({}, form("strategist"))).resolves.toEqual({ error: "Test login is disabled." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unknown roles when enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_TEST_LOGIN", "true");
    await expect(testLogin({}, form("superuser"))).resolves.toEqual({ error: "Unknown test user." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
