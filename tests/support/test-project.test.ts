import { describe, expect, it } from "vitest";
import { resolveTestProject } from "./test-project";

const full = {
  TEST_SUPABASE_URL: "https://testref123.supabase.co",
  TEST_SUPABASE_ANON_KEY: "a",
  TEST_SUPABASE_SERVICE_ROLE_KEY: "s",
};

describe("resolveTestProject", () => {
  it("skips (no project) when nothing is set", () => {
    const r = resolveTestProject({});
    expect(r.project).toBeNull();
    expect(r.reason).toMatch(/Skipped/);
  });

  it("returns the project when fully configured and separate from main", () => {
    const r = resolveTestProject({ ...full, NEXT_PUBLIC_SUPABASE_URL: "https://mainref456.supabase.co", SUPABASE_PROJECT_REF: "mainref456" });
    expect(r.project).toEqual({ url: full.TEST_SUPABASE_URL, anonKey: "a", serviceRoleKey: "s" });
  });

  it("refuses a partial config", () => {
    expect(() => resolveTestProject({ TEST_SUPABASE_URL: full.TEST_SUPABASE_URL })).toThrow(/Incomplete/);
  });

  it("refuses to point at the main project (by URL or project ref)", () => {
    expect(() => resolveTestProject({ ...full, NEXT_PUBLIC_SUPABASE_URL: "https://testref123.supabase.co/" })).toThrow(/main project/);
    expect(() => resolveTestProject({ ...full, SUPABASE_PROJECT_REF: "testref123" })).toThrow(/main project/);
  });
});
