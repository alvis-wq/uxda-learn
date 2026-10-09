import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS, userDb } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

test.describe("learner experience", () => {
  test("quiz challenge auto-grades and publishes", async ({ page }) => {
    await loginAs(page, "designer");

    const category = page.getByRole("link", { name: /\[E2E\] Test challenges/ });
    await expect(category).toContainText("0 of 2 completed");
    await category.click();
    await expect(page.getByRole("heading", { name: "[E2E] Test challenges" })).toBeVisible();
    await page.getByRole("link", { name: /\[E2E\] Quiz/ }).click();

    // Submitting empty shows validation errors instead of saving.
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Choose an answer.")).toBeVisible();

    await page.getByLabel("Lavender").check();
    await page.getByLabel("2", { exact: true }).check();
    await page.getByLabel("4", { exact: true }).check();
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByTestId("attempt-score")).toHaveText("10 / 10");
    await expect(page.getByRole("heading", { name: "[E2E] Quiz" }).locator("..")).toContainText("Completed");
    await expect(page.getByText("You already have full points.")).toBeVisible();

    const id = await profileId(TEST_EMAILS.designer);
    const { data } = await adminDb().from("submissions").select("status,auto_score,final_score,published_at").eq("user_id", id!);
    expect(data).toEqual([expect.objectContaining({ status: "published", auto_score: 10, final_score: 10 })]);
    expect(data![0].published_at).not.toBeNull();

    await page.goto("/");
    await expect(page.getByRole("link", { name: /\[E2E\] Test challenges/ })).toContainText("1 of 2 completed");
  });

  test("screenshot challenge uploads and shows Awaiting review", async ({ page }) => {
    await loginAs(page, "strategist");
    await page.goto("/challenges/e2e-screenshot");

    await expect(page.getByRole("button", { name: "Add screenshots" })).toBeEnabled();
    await page.getByLabel("Choose screenshot files").setInputFiles(path.join(__dirname, "fixtures", "screenshot.png"));
    await expect(page.getByRole("img", { name: "screenshot.png" })).toBeVisible();
    await page.getByLabel(/^Reflection/).fill("The AI forgot the error state entirely.");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Your submission is awaiting review.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "[E2E] Screenshot" }).locator("..")).toContainText("Awaiting review");

    const id = await profileId(TEST_EMAILS.strategist);
    const { data } = await adminDb().from("submissions").select("status,image_paths,final_score").eq("user_id", id!);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ status: "submitted", final_score: null });
    expect(data![0].image_paths[0]).toMatch(new RegExp(`^${id}/e2e-screenshot/[0-9a-f-]{36}\\.png$`));

    // The learner's own submission page shows the uploaded image via a signed URL.
    await page.getByRole("link", { name: "Attempt 1" }).click();
    await expect(page.getByRole("img", { name: "Screenshot 1" })).toBeVisible();
  });

  test("user cannot see another user's submission", async ({ page }) => {
    const db = adminDb();
    const designerId = await profileId(TEST_EMAILS.designer);
    const strategistId = await profileId(TEST_EMAILS.strategist);
    const { data: designerSub } = await db.from("submissions").select("id").eq("user_id", designerId!).single();
    const { data: strategistSub } = await db
      .from("submissions")
      .select("id,image_paths")
      .eq("user_id", strategistId!)
      .single();

    // UI: the strategist gets a 404 for the designer's submission page.
    await loginAs(page, "strategist");
    await page.goto(`/submissions/${designerSub!.id}`);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();

    // API (RLS): signed in as the strategist, the designer's row is invisible.
    const strategist = await userDb("strategist");
    const { data: rows } = await strategist.from("submissions").select("id").eq("id", designerSub!.id);
    expect(rows).toEqual([]);
    const { data: all } = await strategist.from("submissions").select("user_id");
    expect(all?.every((r) => r.user_id === strategistId)).toBe(true);

    // Storage: the designer can't sign or download the strategist's screenshot.
    const designer = await userDb("designer");
    const imgPath = strategistSub!.image_paths[0];
    const { data: signed } = await designer.storage.from("submissions").createSignedUrl(imgPath, 60);
    expect(signed).toBeNull();
    const { data: blob } = await designer.storage.from("submissions").download(imgPath);
    expect(blob).toBeNull();
  });
});
