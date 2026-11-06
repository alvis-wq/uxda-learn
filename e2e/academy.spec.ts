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
    await db.from("academy_reading").delete().in("resource_id", ids);
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
    // Podcast episodes have no quiz (for now): a listener switches them to done.
    .insert({
      kind: "podcast",
      title: `${PREFIX} episode`,
      url: "https://example.com/e2e-academy-episode",
      blog_id: blog!.id,
      released_on: "2026-03-01",
      youtube_url: "https://www.youtube.com/watch?v=e2eAcademy1",
      status: "published",
      questions: [],
    })
    .select("id")
    .single();
  const { data: book } = await db
    .from("academy_resources")
    .insert({ kind: "book", title: `${PREFIX} book`, author: "A. Author", category: "academy", status: "published", questions: QUESTIONS })
    .select("id")
    .single();
  await db.from("academy_quiz_keys").insert([blog, book].map((r) => ({ resource_id: r!.id, answer_key: KEY })));
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanAcademy();
  await seed();
});
test.afterAll(cleanAcademy);

test.describe("Academy", () => {
  test("blog, podcasts and books have their own tabs; a post and its episode link to each other; episodes list where to listen", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Academy" }).click();
    await expect(page).toHaveURL(/\/academy$/);
    const sections = page.getByRole("navigation", { name: "Academy sections" });
    const post = page.getByTestId("blog-list").getByTestId("academy-item").filter({ hasText: `${PREFIX} post` });
    await expect(post.getByRole("link", { name: /Listen to podcast/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=e2eAcademy1");
    await expect(page.getByTestId("blog-list").locator('[data-kind="podcast"]')).toHaveCount(0);

    await sections.getByRole("link", { name: "Podcasts" }).click();
    await expect(page).toHaveURL(/tab=podcasts/);
    const episode = page.getByTestId("podcast-list").getByTestId("academy-item").filter({ hasText: `${PREFIX} episode` });
    await expect(episode.getByText("1 Mar 2026")).toBeVisible();
    await expect(episode.getByRole("link", { name: /Read the blog/ })).toHaveAttribute("href", "https://example.com/e2e-academy-post");
    // Spotify (the show: no episode link here), YouTube, then Buzzsprout; the show links also sit above the list.
    const listen = episode.getByTestId("listen-links");
    await expect(listen.getByRole("link", { name: /YouTube/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=e2eAcademy1");
    await expect(listen.getByRole("link", { name: /Buzzsprout/ })).toHaveAttribute("href", "https://example.com/e2e-academy-episode");
    await expect(listen.getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", /open\.spotify\.com\/show\//);
    await expect(page.getByTestId("podcast-shows").getByRole("link", { name: /Spotify/ })).toHaveAttribute("href", /open\.spotify\.com\/show\//);

    await sections.getByRole("link", { name: "Books" }).click();
    await expect(page).toHaveURL(/tab=books/);
    await expect(page.getByTestId("book-grid").getByText(`${PREFIX} book`)).toBeVisible();
  });

  test("a book can be marked Reading now: it gets a badge, sits on top and has its own filter", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/academy?tab=books");
    const book = () => page.locator('[data-testid="academy-item"][data-kind="book"]').filter({ hasText: `${PREFIX} book` });
    await book().getByTestId("reading-toggle").click();
    await expect(page.getByTestId("reading-now").getByText(`${PREFIX} book`)).toBeVisible();
    await expect(book().getByTestId("reading-badge")).toBeVisible();
    await expect(book().getByTestId("reading-toggle")).toHaveAttribute("aria-pressed", "true");

    const filters = page.getByRole("navigation", { name: "Show" });
    await filters.getByRole("link", { name: "Reading" }).click();
    await expect(page).toHaveURL(/show=reading/);
    await expect(book()).toHaveAttribute("data-reading", "true");
    await filters.getByRole("link", { name: "Not read" }).click();
    await expect(book()).toHaveCount(0);

    await page.goto("/academy?tab=books");
    await book().getByTestId("reading-toggle").click();
    await expect(page.getByTestId("reading-now")).toHaveCount(0);
    await expect(book()).toHaveAttribute("data-reading", "false");
  });

  test("search narrows the current tab", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/academy?tab=books");
    const search = page.getByRole("searchbox", { name: "Search books" });
    await search.fill("a. author");
    await search.press("Enter");
    await expect(page).toHaveURL(/tab=books.*q=a\.\+author|q=a\.%20author/);
    await expect(page.getByTestId("book-grid").getByText(`${PREFIX} book`)).toBeVisible();
    await search.fill("zz no such book");
    await search.press("Enter");
    await expect(page.getByText("Nothing matches “zz no such book”")).toBeVisible();
    await page.getByRole("link", { name: "Clear the search" }).first().click();
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

  test("a podcast episode switches to done without a quiz, and back", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/academy?tab=podcasts");
    const episode = page.locator('[data-testid="academy-item"][data-kind="podcast"]').filter({ hasText: `${PREFIX} episode` });
    await episode.getByRole("switch").click();
    await expect(page.getByTestId("academy-quiz")).toHaveCount(0);
    await expect(episode.getByRole("switch")).toBeChecked();
    await page.reload();
    await expect(episode).toHaveAttribute("data-done", "true");
    await episode.getByRole("switch").click();
    await expect(episode.getByRole("switch")).not.toBeChecked();
    await page.reload();
    await expect(episode).toHaveAttribute("data-done", "false");
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
