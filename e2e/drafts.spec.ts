import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installFixtures } from "./fixtures";
import { adminDb, loginAs, profileId, stepButtons, TEST_EMAILS, userDb } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);
test.afterAll(async () => {
  await installFixtures(); // puts the quiz back as the fixture defines it (a test below edits it)
  await cleanTestUserData();
});

const saved = (page: Page) => expect(page.getByTestId("save-indicator")).toHaveAttribute("data-status", "saved");
const draftOf = async (email: string, slug: string) => {
  const { data } = await adminDb()
    .from("submission_drafts")
    .select("*")
    .eq("user_id", (await profileId(email))!)
    .eq("challenge_slug", slug)
    .maybeSingle();
  return data;
};

test.describe("server-side drafts", () => {
  test("the tip shows above the first question, as a subtle box", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-quiz");
    const tip = page.getByTestId("tip");
    await expect(tip).toContainText("Take your time");
    await expect(tip.locator("strong")).toHaveText("no timer");
    const tipBox = (await tip.boundingBox())!;
    const firstOption = (await page.getByLabel("Green").boundingBox())!;
    expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(firstOption.y); // above the question's options
    await expect(page.getByTestId("draft-notice")).toHaveCount(0); // nothing saved yet
    await expect(page.getByTestId("save-indicator")).toHaveAttribute("data-status", "idle");
  });

  test("answers and the step are saved, and come back after signing out and on another browser", async ({ page, browser }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-quiz");
    const { next, back } = stepButtons(page);
    await page.getByLabel("Lavender").check();
    await saved(page); // one second after the last edit
    expect(await draftOf(TEST_EMAILS.designer, "e2e-quiz")).toMatchObject({ answers: { q1: "b" }, current_step: 1, challenge_version: 1 });

    await next.click(); // a step change is saved at once
    await saved(page);
    await page.getByLabel("2", { exact: true }).check();
    await saved(page);
    expect(await draftOf(TEST_EMAILS.designer, "e2e-quiz")).toMatchObject({ answers: { q1: "b", q2: ["a"] }, current_step: 2 });

    // Sign out, sign back in: right where they were, with the note.
    await page.getByRole("button", { name: "Sign out" }).click();
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-quiz");
    await expect(page.getByTestId("draft-notice")).toContainText("Continue where you left off");
    await expect(page.getByRole("heading", { name: "Pick the even numbers." })).toBeVisible();
    await expect(page.getByLabel("2", { exact: true })).toBeChecked();
    await back.click();
    await expect(page.getByLabel("Lavender")).toBeChecked();

    // A different browser (another device) gets the same.
    const other = await browser.newContext({ reducedMotion: "reduce" });
    const phone = await other.newPage();
    await loginAs(phone, "designer");
    await phone.goto("/challenges/e2e-quiz");
    await expect(phone.getByRole("heading", { name: "Pick the even numbers." })).toBeVisible();
    await expect(phone.getByLabel("2", { exact: true })).toBeChecked();
    await other.close();
  });

  test("the card shows In progress and Continue, on the category page", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/categories/e2e-tests");
    const card = page.getByTestId("challenge-card").filter({ hasText: "[E2E] Quiz" });
    await expect(card).toContainText("In progress");
    await expect(card).toContainText("Continue");
    await expect(page.getByTestId("challenge-card").filter({ hasText: "[E2E] Screenshot" })).not.toContainText("In progress");
    await page.goto("/challenges/e2e-quiz");
    await expect(page.getByRole("heading", { name: "[E2E] Quiz" }).locator("..")).toContainText("In progress");
  });

  test("a draft is private: another user, or an admin, can't read it", async () => {
    const designerId = await profileId(TEST_EMAILS.designer);
    for (const role of ["strategist", "admin"] as const) {
      const { data } = await (await userDb(role)).from("submission_drafts").select("user_id");
      expect((data ?? []).every((r) => r.user_id !== designerId), role).toBe(true);
    }
  });

  test("when the challenge changed: answers that still fit are kept, and the learner is told", async ({ page }) => {
    // The quiz loses option "c" of question 2 (and gets a new version): the saved answer [a] stays; add "c" first.
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-quiz");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("4", { exact: true }).check();
    await saved(page);
    expect((await draftOf(TEST_EMAILS.designer, "e2e-quiz"))?.answers).toMatchObject({ q2: ["a", "c"] });

    const db = adminDb();
    const { data: row } = await db.from("challenges").select("questions,version").eq("slug", "e2e-quiz").single();
    const questions = (row!.questions as { id: string; options?: { id: string }[] }[]).map((q) =>
      q.id === "q2" ? { ...q, options: q.options!.filter((o) => o.id !== "c") } : q,
    );
    await db.from("challenges").update({ questions: questions as never, version: row!.version + 1 }).eq("slug", "e2e-quiz");

    await page.goto("/challenges/e2e-quiz");
    await expect(page.getByTestId("draft-reset-note")).toContainText("Some answers were reset");
    await expect(page.getByLabel("2", { exact: true })).toBeChecked(); // kept
    await expect(page.getByLabel("4", { exact: true })).toHaveCount(0); // gone
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Lavender")).toBeChecked(); // kept

    // The next save carries the new version.
    await page.getByLabel("Green").check();
    await saved(page);
    expect((await draftOf(TEST_EMAILS.designer, "e2e-quiz"))?.challenge_version).toBe(row!.version + 1);
  });

  test("Start over discards the draft after a confirmation", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-quiz");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Keep them" }).click();
    expect(await draftOf(TEST_EMAILS.designer, "e2e-quiz")).not.toBeNull();

    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Yes, start over" }).click();
    await expect(page.getByTestId("draft-notice")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Which colour is the UXDA accent?" })).toBeVisible();
    await expect(page.getByLabel("Lavender")).not.toBeChecked();
    await expect(page.getByLabel("Green")).not.toBeChecked();
    await expect.poll(() => draftOf(TEST_EMAILS.designer, "e2e-quiz")).toBeNull();
    await page.reload();
    await expect(page.getByTestId("draft-notice")).toHaveCount(0);
  });

  test("uploaded screenshots stay in the draft and come back with a preview", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/challenges/e2e-screenshot");
    const { next } = stepButtons(page);
    await next.click();
    await page.getByLabel("Choose screenshot files").setInputFiles(path.join(__dirname, "fixtures", "screenshot.png"));
    await expect(page.getByRole("img", { name: "screenshot.png" })).toBeVisible();
    await saved(page);
    const row = await draftOf(TEST_EMAILS.strategist, "e2e-screenshot");
    expect(row?.image_paths).toHaveLength(1);

    await page.reload();
    await expect(page.getByTestId("draft-notice")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Screenshots", exact: true })).toBeVisible();
    const preview = page.getByRole("img", { name: "Screenshot 1" });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(next).toBeEnabled(); // the restored screenshot counts towards the minimum
  });

  test("a successful submit deletes the draft", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/challenges/e2e-screenshot");
    // The draft restored on the Screenshots step: carry on to the reflection and submit.
    const { next, submit } = stepButtons(page);
    await next.click();
    await page.getByLabel(/^Reflection/).fill("The AI forgot the error state entirely.");
    await next.click();
    await submit.click();
    await expect(page.getByText("Your submission is awaiting review.")).toBeVisible();
    await expect.poll(() => draftOf(TEST_EMAILS.strategist, "e2e-screenshot")).toBeNull();

    // No "In progress" afterwards, and nothing to restore.
    await page.goto("/categories/e2e-tests");
    await expect(page.getByTestId("challenge-card").filter({ hasText: "[E2E] Screenshot" })).not.toContainText("In progress");
  });
});
