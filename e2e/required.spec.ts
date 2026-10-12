import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

// Fixture e2e-ack: acknowledge, required for all, due in the past (so overdue until confirmed).
test.describe("required challenges and acknowledgements", () => {
  test("required + overdue shows on home and first on the category page", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/");
    const section = page.getByTestId("required-section");
    await expect(section.getByTestId("required-summary")).toContainText("0 of 1 required done");
    await expect(section.getByTestId("required-summary")).toContainText("1 overdue");
    // Outstanding required challenges are cards: the title is the link, the overdue badge sits in the meta row.
    const card = section.getByTestId("challenge-card").filter({ has: page.getByRole("link", { name: /\[E2E\] Read the rules/ }) });
    await expect(card).toContainText("Overdue");
    await expect(card).toContainText("Start");

    await page.goto("/categories/e2e-tests");
    const first = page.getByRole("listitem").first();
    await expect(first).toContainText("[E2E] Read the rules");
    await expect(first.getByTestId("required-badge")).toBeVisible();
    await expect(first.getByTestId("overdue-badge")).toBeVisible();
  });

  test("acknowledging completes instantly, is recorded, and leaves scores untouched", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-ack");
    await expect(page.getByText("Read & confirm")).toBeVisible();
    await expect(page.getByText(/pts/)).toHaveCount(0);

    await page.getByRole("button", { name: "I've read and understood" }).click();
    await expect(page.getByTestId("acknowledged")).toContainText("You confirmed you read and understood this");
    await expect(page.getByRole("button", { name: "I've read and understood" })).toHaveCount(0);

    const id = await profileId(TEST_EMAILS.designer);
    const { data } = await adminDb().from("acknowledgements").select("challenge_slug,challenge_version,acknowledged_at").eq("user_id", id!);
    expect(data).toEqual([expect.objectContaining({ challenge_slug: "e2e-ack", challenge_version: 1 })]);
    const { count } = await adminDb().from("submissions").select("id", { count: "exact", head: true }).eq("user_id", id!);
    expect(count).toBe(0);

    await page.goto("/");
    await expect(page.getByTestId("required-summary")).toContainText("1 of 1 required done");
    await expect(page.getByTestId("required-all-done")).toContainText("All required challenges done");
    await expect(page.getByTestId("required-section").getByTestId("challenge-card")).toHaveCount(0);

    await page.goto("/profile");
    await expect(page.getByTestId("stat-total")).toHaveText("0");
    await expect(page.getByTestId("stat-completed")).toHaveText("0");
  });

  test("admin sees who has and hasn't acknowledged, and required progress per track", async ({ page }) => {
    await loginAs(page, "strategist"); // make sure the strategist exists with a track
    await loginAs(page, "admin");

    await page.goto("/admin/acknowledgements");
    const card = page.getByTestId("ack-card-e2e-ack");
    await expect(card.getByTestId("ack-done")).toContainText("Test Designer");
    await expect(card.getByTestId("ack-missing")).toContainText("Test Strategist");

    await page.goto("/admin/required?track=designer");
    await expect(page.getByRole("link", { name: "Designer", exact: true })).toHaveAttribute("aria-current", "page");
    const designer = page.getByTestId(`required-row-${TEST_EMAILS.designer}`);
    await expect(designer).toContainText("1/1 done");
    await expect(page.getByTestId(`required-row-${TEST_EMAILS.strategist}`)).toHaveCount(0);

    await page.goto("/admin/required?track=strategist");
    const strategist = page.getByTestId(`required-row-${TEST_EMAILS.strategist}`);
    await expect(strategist).toContainText("1 overdue");
    await strategist.locator("summary").click();
    await expect(strategist.locator('[data-state="overdue"]')).toBeVisible();

    const res = await page.request.get("/admin/export/required.csv?track=strategist");
    expect(res.status()).toBe(200);
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe("name,email,track,challenge_slug,challenge_title,state,due_at,completed_at");
    expect(lines.some((l) => l.includes(TEST_EMAILS.strategist) && l.includes("e2e-ack") && l.includes("overdue"))).toBe(true);
    expect(lines.some((l) => l.includes(TEST_EMAILS.designer))).toBe(false);
  });

  test("non-admins can't open the admin views or exports", async ({ page }) => {
    await loginAs(page, "designer");
    expect((await page.request.get("/admin/export/required.csv")).status()).toBe(403);
    const res = await page.goto("/admin/required");
    expect(res?.status()).toBe(403);
  });
});
