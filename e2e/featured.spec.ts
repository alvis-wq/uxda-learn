import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanTestUserData, installFixtures } from "./fixtures";
import { adminDb, chooseTheme, loginAs, profileId, TEST_EMAILS } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
const FIXTURES = ["e2e-quiz", "e2e-screenshot"];
/** Featuring is admin-owned and fixtures never write it: clear it before and after, so no other spec sees it. */
async function unfeature() {
  await adminDb().from("challenges").update({ featured_for: [], featured_at: null }).in("slug", FIXTURES);
}
test.beforeAll(async () => {
  await cleanTestUserData();
  await installFixtures();
  await unfeature();
});
test.afterAll(async () => {
  await unfeature();
  await cleanTestUserData();
});

const card = (page: Page, title: string) => page.getByTestId("content-challenge").filter({ hasText: title });
const featuredPicker = (page: Page, title: string) => card(page, title).getByTestId("featured-picker");
const featuredSection = (page: Page) => page.getByTestId("featured-section");
const featuredTitles = (page: Page) => featuredSection(page).getByRole("heading", { level: 3 }).allTextContents();

async function featured(slug: string) {
  const { data } = await adminDb().from("challenges").select("featured_for,featured_at").eq("slug", slug).single();
  return data!;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test("an admin features challenges for some tracks and orders them; learners see them in Featured", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/content");
  await expect(page.getByTestId("featured-order")).toContainText("Nothing featured");

  // The switch starts with everyone who can see it; the tracks can then be narrowed.
  await featuredPicker(page, "[E2E] Quiz").getByRole("switch", { name: "Feature on home" }).click();
  await expect(page.getByText("Featured for saved for “[E2E] Quiz”: Everyone.")).toBeVisible();
  await expect.poll(async () => (await featured("e2e-quiz")).featured_for).toEqual(["all"]);
  await featuredPicker(page, "[E2E] Quiz").getByRole("checkbox", { name: "Everyone" }).click();
  await featuredPicker(page, "[E2E] Quiz").getByRole("checkbox", { name: "Strategist" }).click();
  await expect.poll(async () => (await featured("e2e-quiz")).featured_for).not.toContain("strategist");

  await featuredPicker(page, "[E2E] Screenshot").getByRole("switch", { name: "Feature on home" }).click();
  await expect.poll(async () => (await featured("e2e-screenshot")).featured_for).toEqual(["all"]);

  // The order: oldest first; Move up swaps it with the one above (and both changes are in the history).
  await page.reload();
  const items = page.getByTestId("featured-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("[E2E] Quiz");
  await page.getByRole("button", { name: "Move [E2E] Screenshot up" }).click();
  await expect(page.getByText("“[E2E] Screenshot” moved to #1 in Featured.")).toBeVisible();
  await expect(items.nth(0)).toContainText("[E2E] Screenshot");
  await expect(page.getByRole("button", { name: "Move [E2E] Screenshot down" })).toBeFocused(); // at the top: the other button
  await page.reload();
  await card(page, "[E2E] Screenshot").getByText(/Change history \(\d+\)/).click();
  await expect(card(page, "[E2E] Screenshot").getByTestId("audit-history")).toContainText("Featured order: #2 → #1");
  expect(await axe(page), "admin content with featured items").toEqual([]);

  // A designer sees both, in that order, at the top; not again in the list below.
  await loginAs(page, "designer");
  await page.goto("/");
  await expect(featuredSection(page)).toBeVisible();
  expect(await featuredTitles(page)).toEqual(["[E2E] Screenshot", "[E2E] Quiz"]);
  const list = page.getByTestId("challenge-list");
  await expect(list).not.toContainText("[E2E] Quiz");
  await expect(list).not.toContainText("[E2E] Screenshot");
  const [top, below] = await Promise.all([featuredSection(page).boundingBox(), page.getByTestId("challenges-section").boundingBox()]);
  expect(top!.y).toBeLessThan(below!.y);

  // "Featured" ignores the filter.
  await page.goto("/?category=e2e-tests");
  expect(await featuredTitles(page)).toEqual(["[E2E] Screenshot", "[E2E] Quiz"]);

  // A strategist only sees what's featured for them.
  await loginAs(page, "strategist");
  await page.goto("/");
  expect(await featuredTitles(page)).toEqual(["[E2E] Screenshot"]);

  // Completed: gone from Featured (and from home), for the designer.
  await adminDb().from("submissions").insert({
    user_id: (await profileId(TEST_EMAILS.designer))!,
    challenge_slug: "e2e-quiz",
    challenge_version: 1,
    attempt: 1,
    answers: {},
    status: "published",
    auto_score: 10,
    final_score: 10,
    max_score: 10,
    published_at: new Date().toISOString(),
  });
  await loginAs(page, "designer");
  await page.goto("/");
  expect(await featuredTitles(page)).toEqual(["[E2E] Screenshot"]);
});

test("nothing featured: no Featured section", async ({ page }) => {
  await unfeature();
  await loginAs(page, "designer");
  await page.goto("/");
  await expect(page.getByTestId("challenges-section")).toBeVisible();
  await expect(featuredSection(page)).toHaveCount(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`home with Featured: no WCAG A/AA violations and no horizontal scroll at 375px (${scheme})`, async ({ page }) => {
    await adminDb().from("challenges").update({ featured_for: ["all"], featured_at: new Date().toISOString() }).eq("slug", "e2e-screenshot");
    await chooseTheme(page, scheme);
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "strategist");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(featuredSection(page)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}
