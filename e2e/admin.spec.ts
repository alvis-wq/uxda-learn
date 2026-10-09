import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { adminDb, loginAs, profileId, TEST_EMAILS } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

test.describe("admin", () => {
  test("non-admin gets 403", async ({ page }) => {
    await loginAs(page, "strategist");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    for (const url of ["/admin", "/admin/users", "/admin/content"]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(403);
      await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    }
    const csv = await page.request.get("/admin/export/scores.csv");
    expect(csv.status()).toBe(403);
  });

  test("admin approves an ai_reviewed submission → published → on the leaderboard", async ({ page }) => {
    const db = adminDb();

    // 1. Strategist submits the screenshot challenge.
    await loginAs(page, "strategist");
    await page.goto("/challenges/e2e-screenshot");
    await expect(page.getByRole("button", { name: "Add screenshots" })).toBeEnabled();
    await page.getByLabel("Choose screenshot files").setInputFiles(path.join(__dirname, "fixtures", "screenshot.png"));
    await expect(page.getByRole("img", { name: "screenshot.png" })).toBeVisible();
    await page.getByLabel(/^Reflection/).fill("The AI skipped the loading state and mislabelled a button.");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Your submission is awaiting review.")).toBeVisible();

    // 2. Simulate /evaluate + eval:push (Phase 7): evaluation row + status ai_reviewed.
    const strategistId = (await profileId(TEST_EMAILS.strategist))!;
    const { data: sub } = await db.from("submissions").select("id").eq("user_id", strategistId).single();
    await db.from("evaluations").insert({
      submission_id: sub!.id,
      batch_id: "e2e-batch",
      criteria: [{ id: "quality", score: 7, max: 10, evidence: "Screenshot 1 shows the flow.", comment: "Solid." }],
      total: 7,
      feedback: "AI says: good start, show the error state too.",
      confidence: "low",
      flags: ["figma_inaccessible"],
      model: "e2e-model",
    });
    await db
      .from("submissions")
      .update({ status: "ai_reviewed", final_score: 7, feedback: "AI says: good start, show the error state too." })
      .eq("id", sub!.id);
    await db.from("profiles").update({ show_on_leaderboard: true }).eq("id", strategistId);

    // 3. Admin reviews it.
    await loginAs(page, "admin");
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
    const row = page.getByTestId("queue-row").filter({ hasText: "[E2E] Screenshot" });
    await expect(row).toContainText("AI reviewed");
    await expect(row).toContainText("Low confidence");
    await expect(row).toContainText("figma_inaccessible");
    await row.getByRole("link", { name: "Test Strategist" }).click();

    await expect(page.getByRole("heading", { name: "[E2E] Screenshot" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Screenshot 1" })).toBeVisible();
    await expect(page.getByText("Evidence: Screenshot 1 shows the flow.")).toBeVisible();
    await expect(page.getByLabel(/Final score/)).toHaveValue("7");
    await expect(page.getByLabel("Feedback to the learner")).toHaveValue(/good start/);

    // Score above max is rejected server-side.
    await page.getByLabel(/Final score/).fill("11");
    await page.getByRole("button", { name: "Approve & publish" }).click();
    await expect(page.getByText("Max is 10.")).toBeVisible();

    await page.getByLabel(/Final score/).fill("8");
    await page.getByLabel("Feedback to the learner").fill("Nice work — next time include the error state.");
    await page.getByRole("button", { name: "Approve & publish" }).click();
    await expect(page.getByTestId("admin-status")).toHaveText("Published");

    const adminId = await profileId(TEST_EMAILS.admin);
    const { data: after } = await db.from("submissions").select("status,final_score,published_at,feedback").eq("id", sub!.id).single();
    expect(after).toMatchObject({ status: "published", final_score: 8, feedback: "Nice work — next time include the error state." });
    expect(after!.published_at).not.toBeNull();
    const { data: ev } = await db.from("evaluations").select("approved_by,approved_at").eq("submission_id", sub!.id).single();
    expect(ev).toMatchObject({ approved_by: adminId });

    // Queue is empty again.
    await page.goto("/admin");
    await expect(page.getByTestId("queue-row").filter({ hasText: "[E2E] Screenshot" })).toHaveCount(0);

    // 4. The learner sees the score and feedback, and is on the Strategists leaderboard.
    await loginAs(page, "strategist");
    await page.goto("/leaderboard?track=strategist");
    const me = page.getByTestId("leaderboard-me");
    await expect(me).toContainText("Test Strategist");
    await expect(me.getByRole("cell").last()).toHaveText("8");
    await page.goto("/profile");
    await expect(page.getByTestId("stat-total")).toHaveText("8");
    await expect(page.getByText("Nice work — next time include the error state.")).toBeVisible();
  });

  test("admin can change a user's track, toggle admin and export CSV", async ({ page }) => {
    const db = adminDb();
    await loginAs(page, "designer"); // ensure the designer profile exists with a track
    await loginAs(page, "admin");
    await page.goto("/admin/users");

    const row = page.getByTestId(`user-row-${TEST_EMAILS.designer}`);
    await row.getByRole("combobox", { name: "Track for Test Designer" }).click();
    await page.getByRole("option", { name: "Strategist" }).click();
    await expect(page.getByText("Track updated for Test Designer.")).toBeVisible();
    await expect
      .poll(async () => (await db.from("profiles").select("track").eq("email", TEST_EMAILS.designer).single()).data?.track)
      .toBe("strategist");
    await db.from("profiles").update({ track: "designer" }).eq("email", TEST_EMAILS.designer);

    const adminSwitch = row.getByRole("switch", { name: "Admin access for Test Designer" });
    await adminSwitch.click();
    await expect(page.getByText("Test Designer is now an admin.")).toBeVisible();
    await adminSwitch.click();
    await expect(page.getByText("Test Designer is no longer an admin.")).toBeVisible();
    await expect
      .poll(async () => (await db.from("profiles").select("is_admin").eq("email", TEST_EMAILS.designer).single()).data?.is_admin)
      .toBe(false);

    // Admins can't demote themselves.
    await expect(
      page.getByTestId(`user-row-${TEST_EMAILS.admin}`).getByRole("switch", { name: /Admin access/ }),
    ).toBeDisabled();

    const csv = await page.request.get("/admin/export/scores.csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const body = await csv.text();
    expect(body.split("\r\n")[0]).toMatch(/^name,email,track,total_score,completed,pending_reviews,on_leaderboard/);
    expect(body).toContain(TEST_EMAILS.strategist);

    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Same brief, three tools" })).toBeVisible();
  });
});
