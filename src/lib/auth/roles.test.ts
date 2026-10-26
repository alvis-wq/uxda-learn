import { describe, expect, it } from "vitest";
import { canSeeTeam } from "./roles";

describe("canSeeTeam", () => {
  it("is true for leads and admins only", () => {
    expect(canSeeTeam({ is_admin: false, is_lead: true })).toBe(true);
    expect(canSeeTeam({ is_admin: true, is_lead: false })).toBe(true);
    expect(canSeeTeam({ is_admin: true, is_lead: true })).toBe(true);
    expect(canSeeTeam({ is_admin: false, is_lead: false })).toBe(false);
    expect(canSeeTeam(null)).toBe(false);
    expect(canSeeTeam(undefined)).toBe(false);
  });
});
