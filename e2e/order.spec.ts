import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installOrderFixture, removeOrderFixture } from "./fixtures";
import { loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await installOrderFixture();
});
test.afterAll(async () => {
  await cleanTestUserData();
  await removeOrderFixture();
});

const CORRECT = ["Observation", "Consequence", "Recommendation", "Next step"];
const labels = (page: Page) => page.getByTestId("order-item").locator("span.flex-1").allTextContents();

/** Arrange the list with the Move up buttons (the way a keyboard or touch user would). */
async function arrange(page: Page, order: string[]) {
  for (const [position, label] of order.entries()) {
    while ((await labels(page)).indexOf(label) > position) {
      await page.getByRole("button", { name: `Move ${label} up` }).click();
    }
  }
}

test.describe("order question", () => {
  test("starts shuffled, is graded all-or-nothing and follows the reveal rules", async ({ page }) => {
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-order");

    // The starting order is never the correct one, and nothing is answered until the learner moves something.
    expect(await labels(page)).not.toEqual(CORRECT);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Put the items in order.")).toBeVisible();

    // Attempt 1: right except the last two are swapped.
    await arrange(page, ["Observation", "Consequence", "Next step", "Recommendation"]);
    expect(await labels(page)).toEqual(["Observation", "Consequence", "Next step", "Recommendation"]);
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    // The result opens straight away: ✗, and no key while attempts are left.
    await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("question-mark")).toHaveText("Incorrect");
    await expect(page.getByTestId("answer")).toHaveAttribute("data-result", "incorrect");
    await expect(page.getByTestId("right-answer")).toHaveCount(0);
    await expect(page.getByTestId("try-again")).toHaveText("Try again to find the right answer — 2 attempts left.");

    // Attempt 2: all correct.
    await page.getByTestId("try-again-link").click();
    await arrange(page, CORRECT);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("attempt-result-score")).toHaveText("4 / 4 pts");
    await expect(page.getByTestId("question-mark")).toHaveText("Correct");

    // With full marks the first attempt now shows the right order.
    await page.goto("/challenges/e2e-order");
    await page.getByRole("link", { name: "Attempt 1" }).click();
    await expect(page.getByTestId("question-mark")).toHaveText("Incorrect");
    await expect(page.getByTestId("right-answer")).toContainText("Correct order:");
    await expect(page.getByTestId("right-answer").getByRole("listitem")).toHaveText(CORRECT);
  });

  test("keyboard: Space picks an item up, the arrow keys move it, Space drops it", async ({ page }) => {
    await cleanTestUserData();
    await loginAs(page, "designer");
    await page.goto("/challenges/e2e-order");
    const first = (await labels(page))[0];
    await page.getByRole("button", { name: `Drag ${first}` }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect.poll(async () => (await labels(page))[1]).toBe(first);
  });
});
