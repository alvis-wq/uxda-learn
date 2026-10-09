import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { loginAs, type Role } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();
test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);

const LEARNER_PAGES = [
  "/",
  "/categories/e2e-tests",
  "/challenges/e2e-quiz",
  "/challenges/e2e-screenshot",
  "/leaderboard",
  "/profile",
  "/does-not-exist",
];
const ADMIN_PAGES = ["/admin", "/admin/users", "/admin/content"];

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
    await page.emulateMedia({ colorScheme: scheme });
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
