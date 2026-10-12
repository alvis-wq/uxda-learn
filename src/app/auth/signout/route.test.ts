import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signOut = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));

const { POST } = await import("./route");

describe("POST /auth/signout", () => {
  beforeEach(() => signOut.mockClear());

  it("signs out, goes to /login, and clears the loader's session cookie", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/auth/signout", { method: "POST" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("uxda_intro=;");
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toContain("Path=/");
  });
});
