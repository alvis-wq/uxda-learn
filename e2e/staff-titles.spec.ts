import { expect, test } from "@playwright/test";
import { adminDb, clearTitles, loginAs, PENDING_TITLE_EMAIL, setTitle, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(clearTitles);
test.afterAll(clearTitles);

const FIXED_EMAIL = PENDING_TITLE_EMAIL.replace("e2e-", "e2e-fixed-");

const audit = (email: string) =>
  adminDb()
    .from("staff_audit")
    .select("field,old_value,new_value,source")
    .eq("email", email.toLowerCase())
    .neq("field", "track")
    .order("id");

test.describe("job titles", () => {
  test("show under the name on home and profile; nothing when there's none", async ({ page }) => {
    await setTitle(TEST_EMAILS.designer, "Lead UX/UI Designer");

    await loginAs(page, "designer");
    await page.goto("/");
    await expect(page.getByTestId("hero").getByTestId("job-title")).toHaveText("Lead UX/UI Designer");
    await page.goto("/profile");
    await expect(page.getByTestId("page-subtitle")).toHaveText("Lead UX/UI Designer");

    await loginAs(page, "strategist"); // no title
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
    await expect(page.getByTestId("job-title")).toHaveCount(0);
    await page.goto("/profile");
    await expect(page.getByTestId("page-subtitle")).toHaveCount(0);
  });

  test("an admin edits a title on Admin → Users, and it's audited", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const row = page.getByTestId(`user-row-${TEST_EMAILS.strategist}`);
    const field = row.getByRole("textbox", { name: /^Job title for / });
    await field.fill("Senior UX Strategist");
    await row.getByRole("button", { name: /^Save job title for / }).click();
    await expect(page.getByText(/Title updated for/)).toBeVisible();
    await expect.poll(async () => (await audit(TEST_EMAILS.strategist)).data).toEqual([
      { field: "job_title", old_value: null, new_value: "Senior UX Strategist", source: "admin" },
    ]);

    await loginAs(page, "strategist");
    await page.goto("/");
    await expect(page.getByTestId("job-title")).toHaveText("Senior UX Strategist");
  });

  test("Not signed in yet: an admin fixes a wrong email and removes a title", async ({ page }) => {
    await setTitle(PENDING_TITLE_EMAIL, "UX Strategist");
    await loginAs(page, "admin");
    await page.goto("/admin/users");

    const pending = page.getByTestId(`pending-staff-${PENDING_TITLE_EMAIL}`);
    await expect(pending).toBeVisible();
    // Signed-in test users never show up in this list.
    await expect(page.getByTestId(`pending-staff-${TEST_EMAILS.strategist}`)).toHaveCount(0);

    await pending.getByRole("textbox", { name: `Email for ${PENDING_TITLE_EMAIL}` }).fill(FIXED_EMAIL);
    await pending.getByRole("button", { name: `Save ${PENDING_TITLE_EMAIL}` }).click();
    const fixed = page.getByTestId(`pending-staff-${FIXED_EMAIL}`);
    await expect(fixed).toBeVisible();
    await expect(page.getByTestId(`pending-staff-${PENDING_TITLE_EMAIL}`)).toHaveCount(0);
    await expect.poll(async () => (await audit(FIXED_EMAIL)).data).toEqual([
      { field: "email", old_value: PENDING_TITLE_EMAIL, new_value: FIXED_EMAIL, source: "admin" },
    ]);

    await fixed.getByRole("button", { name: `Remove the title for ${FIXED_EMAIL}` }).click();
    await expect(fixed).toHaveCount(0);
    const { data: left } = await adminDb().from("staff_titles").select("email").eq("email", FIXED_EMAIL);
    expect(left).toEqual([]);
  });
});

test.describe("tracks", () => {
  test("Admin → Users offers only the four tracks, and a change is audited", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const row = page.getByTestId(`user-row-${TEST_EMAILS.designer}`);
    await row.getByRole("combobox", { name: /^Track for / }).click();
    const options = page.getByRole("option");
    await expect(options).toHaveText(["Strategist", "Designer", "Motion Designer", "Management"]);
    await page.getByRole("option", { name: "Motion Designer" }).click();
    await expect(page.getByText(/Track updated for/)).toBeVisible();

    const { data } = await adminDb()
      .from("staff_audit")
      .select("old_value,new_value,source")
      .eq("email", TEST_EMAILS.designer.toLowerCase())
      .eq("field", "track")
      .order("id", { ascending: false })
      .limit(1);
    expect(data).toEqual([{ old_value: "designer", new_value: "motion_designer", source: "admin" }]);

    // Back to Designer for the other specs.
    await row.getByRole("combobox", { name: /^Track for / }).click();
    await page.getByRole("option", { name: "Designer", exact: true }).click();
    await expect(page.getByText(/Track updated for/).first()).toBeVisible();
  });
});
