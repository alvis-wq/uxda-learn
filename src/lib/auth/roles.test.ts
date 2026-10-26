import { describe, expect, it } from "vitest";
import { canEditAcademy, canSeeTeam } from "./roles";

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

describe("canEditAcademy", () => {
  it("is true for Academy editors and admins only", () => {
    expect(canEditAcademy({ is_admin: false, is_academy_editor: true })).toBe(true);
    expect(canEditAcademy({ is_admin: true, is_academy_editor: false })).toBe(true);
    expect(canEditAcademy({ is_admin: false, is_academy_editor: false })).toBe(false);
    expect(canEditAcademy(null)).toBe(false);
    expect(canEditAcademy(undefined)).toBe(false);
  });
});
