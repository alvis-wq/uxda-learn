import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "uxdesignagency.com");

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const queueSignInIntro = vi.fn(async () => {});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession, signOut } }) }));
vi.mock("@/lib/intro-server", () => ({ queueSignInIntro }));

const { GET } = await import("./route");
const call = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${query}`));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    signOut.mockClear();
    queueSignInIntro.mockClear();
  });

  it("a successful sign-in queues the loader before redirecting to the first page", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { email: "someone@uxdesignagency.com" } }, error: null });
    const order: string[] = [];
    queueSignInIntro.mockImplementation(async () => void order.push("queue"));
    const response = await call("?code=abc&next=/challenges/x");
    order.push("redirect");
    expect(queueSignInIntro).toHaveBeenCalledOnce();
    expect(order).toEqual(["queue", "redirect"]);
    expect(response.headers.get("location")).toBe("http://localhost:3000/challenges/x");
  });

  it("queues the loader again on a later sign-in (it isn't once-per-browser)", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { email: "someone@uxdesignagency.com" } }, error: null });
    await call("?code=one");
    await call("?code=two");
    expect(queueSignInIntro).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["no code", "", null],
    ["an OAuth error", "?error=access_denied", null],
  ])("does not queue the loader for %s", async (_label, query) => {
    const response = await call(query);
    expect(queueSignInIntro).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/auth/error");
  });

  it("does not queue the loader when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await call("?code=bad");
    expect(queueSignInIntro).not.toHaveBeenCalled();
  });

  it("does not queue the loader for a non-UXDA account (signed straight back out)", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { email: "x@gmail.com" } }, error: null });
    const response = await call("?code=abc");
    expect(signOut).toHaveBeenCalledOnce();
    expect(queueSignInIntro).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("reason=domain");
  });
});
