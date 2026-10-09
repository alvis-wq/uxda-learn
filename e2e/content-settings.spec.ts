import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installFixtures } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);
// Settings changed here would leak into other specs: put the fixtures back afterwards.
test.afterAll(installFixtures);

const card = (page: Page, title: string) => page.getByTestId("content-challenge").filter({ hasText: title });

async function setting(slug: string) {
  const { data } = await adminDb().from("challenges").select("status,required_for,due_at").eq("slug", slug).single();
  return data!;
}

test.describe("admin content settings", () => {
  test("status, required for and due date save instantly and are audited", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/content");
    const quiz = card(page, "[E2E] Quiz");

    // Status: published → draft, with a confirmation toast and an audit entry.
    await quiz.getByRole("combobox", { name: "Status of [E2E] Quiz" }).click();
    await page.getByRole("option", { name: "Draft" }).click();
    await expect(page.getByText("Status saved for “[E2E] Quiz”: Draft.")).toBeVisible();
    await expect.poll(async () => (await setting("e2e-quiz")).status).toBe("draft");

    // Required for: one track, then everyone, then optional again.
    await quiz.getByRole("checkbox", { name: "Designer", exact: true }).click();
    await expect(page.getByText("Required for saved for “[E2E] Quiz”: Designer.")).toBeVisible();
    await expect.poll(async () => (await setting("e2e-quiz")).required_for).toEqual(["designer"]);
    await quiz.getByRole("checkbox", { name: "Everyone" }).click();
    await expect.poll(async () => (await setting("e2e-quiz")).required_for).toEqual(["all"]);
    await expect(quiz.getByRole("checkbox", { name: "Strategist" })).toBeDisabled();
    await quiz.getByRole("checkbox", { name: "Everyone" }).click();
    await expect.poll(async () => (await setting("e2e-quiz")).required_for).toEqual([]);

    // Due date: saved when leaving the field (browser local time), then cleared.
    const due = quiz.getByLabel("Due date");
    await due.fill("2030-01-15T10:30");
    await due.blur();
    await expect(page.getByText(/Due date saved for “\[E2E\] Quiz”: 15 Jan 2030/)).toBeVisible();
    const expected = await page.evaluate(() => new Date("2030-01-15T10:30").getTime());
    await expect.poll(async () => new Date((await setting("e2e-quiz")).due_at ?? 0).getTime()).toBe(expected);
    await quiz.getByRole("button", { name: "Clear" }).click();
    await expect.poll(async () => (await setting("e2e-quiz")).due_at).toBeNull();

    // History: newest first, with who made the change.
    await page.reload();
    const history = card(page, "[E2E] Quiz");
    await history.getByText(/Change history \(\d+\)/).click();
    const entries = history.getByTestId("audit-history").getByRole("listitem");
    await expect(entries).toHaveCount(6);
    await expect(entries.first()).toContainText(/Due date: 15 Jan 2030, \d\d:\d\d → No due date/);
    await expect(entries.last()).toContainText("Status: Published → Draft");
    await expect(entries.last()).toContainText("Test Admin");

    const adminId = await profileId(TEST_EMAILS.admin);
    const { data: audit } = await adminDb()
      .from("challenge_settings_audit")
      .select("field,old_value,new_value,source,changed_by")
      .eq("challenge_slug", "e2e-quiz")
      .order("id");
    expect(audit?.[0]).toEqual({ field: "status", old_value: "published", new_value: "draft", source: "admin", changed_by: adminId });
    expect(audit?.map((a) => a.field)).toEqual(["status", "required_for", "required_for", "required_for", "due_at", "due_at"]);
  });

  test("required for is limited to tracks that can see the challenge", async ({ page }) => {
    // Narrow the fixture's audience to designers: strategists can't see it any more.
    await adminDb().from("challenges").update({ audiences: ["designer"] }).eq("slug", "e2e-screenshot");
    await loginAs(page, "admin");
    await page.goto("/admin/content");
    const shot = card(page, "[E2E] Screenshot");
    await expect(shot.getByRole("checkbox", { name: "Strategist" })).toBeDisabled();
    await expect(shot.getByRole("checkbox", { name: "Everyone" })).toBeDisabled();
    await expect(shot.getByRole("checkbox", { name: "Designer", exact: true })).toBeEnabled();
  });

  test("publishing is blocked while the content has a TODO placeholder", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/content");
    const draft = card(page, "[E2E] Draft with placeholder");
    await expect(draft.getByTestId("placeholder-warning")).toContainText("TODO_FIGMA_URL (brief, grader notes)");

    await draft.getByRole("combobox", { name: "Status of [E2E] Draft with placeholder" }).click();
    await page.getByRole("option", { name: "Published" }).click();
    await expect(page.getByText(/Can't publish: the content still has placeholders — TODO_FIGMA_URL/)).toBeVisible();
    await expect(draft.getByRole("combobox", { name: /Status of/ })).toHaveText("Draft");
    expect((await setting("e2e-draft-todo")).status).toBe("draft");
    const { count } = await adminDb()
      .from("challenge_settings_audit")
      .select("id", { count: "exact", head: true })
      .eq("challenge_slug", "e2e-draft-todo");
    expect(count).toBe(0);
  });

  test("admin preview shows correct answers, rubric and grader notes", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/content");
    await card(page, "[E2E] Quiz").getByRole("link", { name: "Preview with answers" }).click();
    await expect(page.getByRole("heading", { name: "[E2E] Quiz" })).toBeVisible();
    const q1 = page.getByTestId("preview-question").first();
    await expect(q1.locator('[data-correct="true"]')).toHaveText(/Lavender/);
    await expect(q1.locator('[data-correct="false"]')).toHaveText(/Green/);
    const q2 = page.getByTestId("preview-question").nth(1);
    await expect(q2.locator('[data-correct="true"]')).toHaveCount(2);

    await page.goto("/admin/content/e2e-screenshot");
    await expect(page.getByRole("heading", { name: "Rubric" })).toBeVisible();
    await expect(page.getByText("Shows the thing")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grader notes" })).toBeVisible();
    await expect(page.getByText("E2E fixture — any screenshot is fine.")).toBeVisible();

    // The learner's view of the same quiz never includes the answers.
    await loginAs(page, "designer");
    const res = await page.goto("/challenges/e2e-quiz");
    const html = (await res?.text()) ?? "";
    expect(html).not.toContain("Correct");
    expect(html).not.toMatch(/"answer"/);
    const blocked = await page.goto("/admin/content/e2e-quiz");
    expect(blocked?.status()).toBe(403);
  });
});
