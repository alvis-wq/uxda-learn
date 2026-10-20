import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import {
  chooseTheme,
  clearTitles,
  loginAs,
  PENDING_TITLE_EMAIL,
  setTitle,
  stepButtons,
  TEST_EMAILS,
  type Role,
} from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);
// A job title under the strategist's name (home, profile) and a row in "Not signed in yet" (Admin → Users).
test.beforeAll(async () => {
  await clearTitles();
  await setTitle(TEST_EMAILS.strategist, "Senior UX Strategist");
  await setTitle(PENDING_TITLE_EMAIL, "UX/UI Designer");
});
test.afterAll(clearTitles);

const LEARNER_PAGES = [
  "/",
  "/categories/e2e-tests",
  "/challenges/e2e-quiz",
  "/challenges/e2e-screenshot",
  "/challenges/e2e-ack",
  "/leaderboard",
  "/heroes",
  "/profile",
  "/does-not-exist",
];
const ADMIN_PAGES = [
  "/admin",
  "/admin/users",
  "/admin/required",
  "/admin/acknowledgements",
  "/admin/content",
  "/admin/content/e2e-quiz",
  "/admin/content/e2e-draft-todo",
];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function visit(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

for (const scheme of ["light", "dark"] as const) {
  test(`no WCAG A/AA violations (${scheme} mode)`, async ({ page }) => {
    await chooseTheme(page, scheme);
    const problems: string[] = [];

    await page.context().clearCookies();
    await visit(page, "/login");
    problems.push(...(await axe(page)).map((v) => `/login: ${v}`));

    const runAs = async (role: Role, urls: string[]) => {
      await loginAs(page, role);
      for (const url of urls) {
        await visit(page, url);
        problems.push(...(await axe(page)).map((v) => `${url}: ${v}`));
      }
    };
    await runAs("strategist", [...LEARNER_PAGES, "/admin"]); // /admin = the 403 page
    await runAs("admin", ADMIN_PAGES);

    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("no horizontal scrolling at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const overflowing: string[] = [];
  const check = async (url: string) => {
    await visit(page, url);
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    if (scroll > client) overflowing.push(`${url}: ${scroll}px > ${client}px`);
  };

  await page.context().clearCookies();
  await check("/login");
  await loginAs(page, "strategist");
  for (const url of LEARNER_PAGES) await check(url);
  await loginAs(page, "admin");
  for (const url of ADMIN_PAGES) await check(url);

  expect(overflowing, overflowing.join("\n")).toEqual([]);
});

test("keyboard: skip link moves focus to the main content", async ({ page }) => {
  await loginAs(page, "strategist");
  await visit(page, "/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

for (const scheme of ["light", "dark"] as const) {
  test(`stepped challenge: every step passes axe and fits at 375px (${scheme} mode)`, async ({ page }) => {
    await chooseTheme(page, scheme);
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "strategist");
    await visit(page, "/challenges/e2e-screenshot");

    const problems: string[] = [];
    const { next } = stepButtons(page);
    const checkStep = async (label: string) => {
      await expect(page.locator(".stepper__pane--leaving")).toHaveCount(0); // the step change has finished animating
      problems.push(...(await axe(page)).map((v) => `${label}: ${v}`));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${label}: overflows by ${overflow}px`);
    };

    await checkStep("Brief");
    await next.click();
    await expect(page.getByRole("heading", { name: "Screenshots", exact: true })).toBeFocused();
    await checkStep("Screenshots (empty, Continue disabled)");
    await page.getByLabel("Choose screenshot files").setInputFiles(path.join(__dirname, "fixtures", "screenshot.png"));
    await expect(page.getByRole("img", { name: "screenshot.png" })).toBeVisible();
    await checkStep("Screenshots (uploaded)");
    await next.click();
    await expect(page.getByRole("heading", { name: "Reflection", exact: true })).toBeFocused();
    await checkStep("Reflection (empty)");
    await page.getByLabel(/^Reflection/).fill("The AI forgot the error state entirely.");
    await next.click();
    await expect(page.getByRole("heading", { name: "Review & submit", exact: true })).toBeFocused();
    await checkStep("Review");

    expect(problems, problems.join("\n")).toEqual([]);
  });
}
