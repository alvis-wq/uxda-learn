import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installInstantFixture, removeInstantFixture } from "./fixtures";
import { chooseTheme, loginAs } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await cleanTestUserData();
  await installInstantFixture();
});
test.afterAll(async () => {
  await cleanTestUserData();
  await removeInstantFixture();
});

const PROMPTS = {
  pick: "Which letter comes second?",
  pairs: "Match each file to its purpose.",
  tf: "Every output gets checked.",
} as const;
type Id = keyof typeof PROMPTS;

const quiz = (page: Page) => page.getByTestId("instant-quiz");
const continueButton = (page: Page) => quiz(page).getByRole("button", { name: "Continue" });
const dialog = (page: Page) => page.getByRole("dialog");

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Which question is showing (the order is shuffled per attempt). */
async function current(page: Page): Promise<Id> {
  const heading = (await quiz(page).getByRole("heading", { level: 3 }).textContent())?.trim();
  const id = (Object.keys(PROMPTS) as Id[]).find((k) => PROMPTS[k] === heading);
  if (!id) throw new Error(`Unknown question: ${heading}`);
  return id;
}

/** Answer the showing question, right or wrong. The match question uses the menus (the no-drag way). */
async function answer(page: Page, id: Id, right: boolean) {
  if (id === "pick") await page.getByLabel(right ? "Bravo" : "Alpha").check();
  if (id === "tf") await page.getByLabel(right ? "True" : "False").check();
  if (id === "pairs") {
    const put = async (item: string, category: string) => {
      await page.getByRole("combobox", { name: `Category for ${item}` }).click();
      await page.getByRole("option", { name: category }).click();
    };
    await put("Framework", right ? "The guide: what to do" : "Where the work goes");
    await put("Workspace", right ? "Where the work goes" : "The guide: what to do");
  }
}

test("checks each answer as you go, scores by tries and allows one attempt", async ({ page }) => {
  await loginAs(page, "designer");
  await page.goto("/challenges/e2e-instant");
  await expect(quiz(page)).toBeVisible();
  await expect(page.getByText("Attempt 1 of 1")).toBeVisible();
  // Nothing chosen yet: Continue waits for an answer.
  await expect(continueButton(page)).toBeDisabled();

  // The first question: wrong once.
  const first = await current(page);
  await answer(page, first, false);
  await continueButton(page).click();
  await expect(dialog(page)).toContainText("Not quite — try again.");
  await expect(dialog(page)).not.toContainText(/second letter|guides|responsible/); // no explanation, no answer
  expect(await axe(page), "wrong-answer dialog").toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  // Focus returns to the question (Continue stays disabled until the answer changes).
  await expect(quiz(page).getByRole("heading", { level: 3 })).toBeFocused();
  expect(await current(page)).toBe(first);
  // The same wrong answer can't be sent again.
  await expect(continueButton(page)).toBeDisabled();
  await expect(quiz(page)).toContainText("Change your answer to try again.");

  // A refresh doesn't reset the tries (counted on the server).
  await page.reload();
  expect(await current(page)).toBe(first);
  await expect(page.getByTestId("instant-scoring")).toHaveText("1 try so far: a right answer now earns half points.");

  // Right on the second try: the explanation, then the next question.
  await answer(page, first, true);
  await continueButton(page).click();
  await expect(dialog(page)).toContainText("Correct!");
  expect(await axe(page), "right-answer dialog").toEqual([]);
  await dialog(page).getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("instant-progress")).toHaveText("1 of 3 done");
  await expect(quiz(page).getByRole("heading", { level: 3 })).toBeFocused();

  // The other two right on the first try.
  for (let n = 0; n < 2; n++) {
    const id = await current(page);
    expect(id).not.toBe(first);
    await answer(page, id, true);
    await continueButton(page).click();
    await expect(dialog(page)).toContainText("Correct!");
    await dialog(page).getByRole("button", { name: n === 1 ? "See your result" : "Continue" }).click();
  }

  // Published: 2 + 2 + 1 (half points for the second try).
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("attempt-result-score")).toHaveText("5 / 6 pts");
  // Each question with its try and points (in the challenge's own order, so compared sorted).
  expect((await page.getByTestId("question-tries").allTextContents()).sort()).toEqual([
    "1st try · 2 / 2 pts",
    "1st try · 2 / 2 pts",
    "2nd try · 1 / 2 pts",
  ]);
  await expect(page.getByTestId("explanation")).toHaveCount(3);
  await expect(page.getByTestId("try-again-link")).toHaveCount(0);

  // One attempt: the challenge has no form any more.
  await page.goto("/challenges/e2e-instant");
  await expect(page.getByText("This quiz has one attempt, and you've completed it.")).toBeVisible();
  await expect(quiz(page)).toHaveCount(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`question page and dialog: no WCAG A/AA violations and no horizontal scroll at 375px (${scheme})`, async ({ page }) => {
    await cleanTestUserData();
    await chooseTheme(page, scheme);
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "strategist");
    await page.goto("/challenges/e2e-instant");
    await page.waitForLoadState("networkidle");

    const problems: string[] = [];
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Every question (the match one included), and the right-answer dialog on each.
    for (let n = 0; n < 3; n++) {
      problems.push(...(await axe(page)).map((v) => `question ${n + 1}: ${v}`));
      expect(await overflow(), `question ${n + 1}`).toBeLessThanOrEqual(0);
      const id = await current(page);
      await answer(page, id, true);
      await continueButton(page).click();
      await expect(dialog(page)).toBeVisible();
      problems.push(...(await axe(page)).map((v) => `dialog ${n + 1}: ${v}`));
      await dialog(page).getByRole("button", { name: n === 2 ? "See your result" : "Continue" }).click();
    }
    await expect(page).toHaveURL(/\/submissions\//);
    await page.waitForLoadState("networkidle");
    problems.push(...(await axe(page)).map((v) => `result: ${v}`));
    expect(await overflow(), "result").toBeLessThanOrEqual(0);
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
