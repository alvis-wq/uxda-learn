import { expect, test } from "@playwright/test";
import { adminDb, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

const PREFIX = "[E2E] Academy";
// A fixed quiz: in every question option "a" is right (the app shuffles when an editor saves; seeded here as stored).
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i + 1}`,
  kind: "single",
  prompt: `${PREFIX} question ${i + 1}?`,
  options: [
    { id: "a", label: `Right ${i + 1}` },
    { id: "b", label: `Wrong ${i + 1}b` },
    { id: "c", label: `Wrong ${i + 1}c` },
    { id: "d", label: `Wrong ${i + 1}d` },
  ],
  points: 1,
}));
const KEY = Object.fromEntries(QUESTIONS.map((q) => [q.id, "a"]));

async function cleanAcademy() {
  const db = adminDb();
  const { data } = await db.from("academy_resources").select("id").like("title", `${PREFIX}%`);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length) {
    await db.from("academy_completions").delete().in("resource_id", ids);
    await db.from("academy_resources").update({ blog_id: null }).in("id", ids);
    await db.from("academy_resources").delete().in("id", ids);
  }
  await db.from("profiles").update({ is_academy_editor: false }).eq("email", TEST_EMAILS.designer);
}

async function seed() {
  const db = adminDb();
  const { data: blog } = await db
    .from("academy_resources")
    .insert({ kind: "blog", title: `${PREFIX} post`, url: "https://example.com/e2e-academy-post", description: "A post.", status: "published", questions: QUESTIONS, sort_key: 9_999_999_999 })
    .select("id")
    .single();
  const { data: pod } = await db
    .from("academy_resources")
    .insert({ kind: "podcast", title: `${PREFIX} episode`, url: "https://example.com/e2e-academy-episode", blog_id: blog!.id, status: "published", questions: QUESTIONS })
    .select("id")
    .single();
  const { data: book } = await db
    .from("academy_resources")
    .insert({ kind: "book", title: `${PREFIX} book`, author: "A. Author", category: "academy", status: "published", questions: QUESTIONS })
    .select("id")
    .single();
  await db.from("academy_quiz_keys").insert([blog, pod, book].map((r) => ({ resource_id: r!.id, answer_key: KEY })));
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanAcademy();
  await seed();
});
test.afterAll(cleanAcademy);

test.describe("Academy", () => {
  test("a post and its podcast episode share a row; books are on their own tab", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Academy" }).click();
    await expect(page).toHaveURL(/\/academy$/);
    const row = page.getByTestId("blog-pod-row").filter({ hasText: `${PREFIX} post` });
    await expect(row.getByTestId("academy-item")).toHaveCount(2);
    await expect(row.locator('[data-kind="podcast"]')).toContainText(`${PREFIX} episode`);

    await page.getByRole("navigation", { name: "Academy sections" }).getByRole("link", { name: "Books" }).click();
    await expect(page).toHaveURL(/tab=books/);
    await expect(page.getByTestId("book-grid").getByText(`${PREFIX} book`)).toBeVisible();
  });

  test("switching to done opens the quiz: 3 of 5 isn't enough, 5 of 5 marks it done", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/academy");
    const item = page.locator('[data-testid="academy-item"][data-kind="blog"]').filter({ hasText: `${PREFIX} post` });
    await item.getByRole("switch").click();
    const quiz = page.getByTestId("academy-quiz");
    await expect(quiz).toBeVisible();

    // Two wrong.
    for (let i = 1; i <= 5; i++) await quiz.getByLabel(i <= 2 ? `Wrong ${i}b` : `Right ${i}`).check();
    await quiz.getByRole("button", { name: "Check answers" }).click();
    await expect(quiz.getByTestId("quiz-failed")).toContainText("3 of 5 right");
    await expect(quiz.getByText("Not quite.")).toHaveCount(2);

    // Try again: the wrong ones are cleared, the right ones kept.
    await quiz.getByRole("button", { name: "Try again" }).click();
    await quiz.getByLabel("Right 1").check();
    await quiz.getByLabel("Right 2").check();
    await quiz.getByRole("button", { name: "Check answers" }).click();
    await expect(quiz.getByTestId("quiz-passed")).toContainText("5 of 5 right");
    await quiz.getByRole("button", { name: "Close" }).click();

    await expect(item).toHaveAttribute("data-done", "true");
    await expect(item.getByRole("switch")).toBeDisabled();
    const id = await profileId(TEST_EMAILS.strategist);
    const { data } = await adminDb().from("academy_quiz_attempts").select("correct,passed").eq("user_id", id!).order("created_at");
    expect(data?.slice(-2)).toEqual([
      { correct: 3, passed: false },
      { correct: 5, passed: true },
    ]);
  });

  test("Academy management: 403 for others, editors get /academy/manage, admins Admin → Academy", async ({ page }) => {
    await loginAs(page, "designer");
    expect((await page.goto("/academy/manage"))?.status()).toBe(403);
    await expect(page.getByRole("link", { name: "Manage Academy" })).toHaveCount(0);

    await adminDb().from("profiles").update({ is_academy_editor: true }).eq("email", TEST_EMAILS.designer);
    await page.goto("/academy");
    await page.getByRole("link", { name: "Manage Academy" }).click();
    await expect(page).toHaveURL(/\/academy\/manage$/);
    await page.getByRole("link", { name: /Book/ }).first().click();
    await page.getByLabel("Title").fill(`${PREFIX} new book`);
    await page.getByLabel("Author").fill("B. Writer");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page).toHaveURL(/\/academy\/manage\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("status-controls").getByRole("button", { name: "Publish" })).toBeDisabled(); // no quiz yet

    await loginAs(page, "admin");
    await page.goto("/admin/academy?review=todo");
    await expect(page.getByTestId("academy-manage-row").filter({ hasText: `${PREFIX} new book` })).toBeVisible();
  });
});
