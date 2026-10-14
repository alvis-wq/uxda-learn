import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanTestUserData } from "./fixtures";
import { loginAs, stepButtons } from "./helpers";
import { requireTestProject } from "./project";

requireTestProject();

test.describe.configure({ mode: "serial" });
test.beforeAll(cleanTestUserData);
test.afterAll(cleanTestUserData);

const PNG = readFileSync(path.join(__dirname, "fixtures", "screenshot.png")).toString("base64");

test("screenshots can be pasted and dropped, and the capture shortcuts are explained", async ({ page }) => {
  await loginAs(page, "strategist");
  await page.goto("/challenges/e2e-screenshot");
  await stepButtons(page).next.click(); // Brief → Screenshots
  await expect(page.getByRole("heading", { name: "Screenshots", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Add screenshots" })).toBeEnabled();

  await expect(page.getByTestId("screenshot-help")).toHaveText(
    "Mac: ⌘⇧4 to capture an area (⌘⇧⌃4 copies it, then paste here). Windows: Win+Shift+S, then paste.",
  );

  // Paste (what Cmd/Ctrl+V on a copied screenshot delivers).
  await page.evaluate((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "image.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await expect(page.getByRole("img", { name: "Pasted screenshot.png" })).toBeVisible();
  await expect(page.getByTestId("screenshot-status")).toContainText("from the clipboard");

  // Drop onto the zone: it lights up while a file is over it.
  const zone = page.getByTestId("screenshot-dropzone");
  const dt = await page.evaluateHandle((b64) => {
    const d = new DataTransfer();
    d.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "dropped.png", { type: "image/png" }));
    return d;
  }, PNG);
  await zone.dispatchEvent("dragenter", { dataTransfer: dt });
  await expect(zone).toHaveAttribute("data-dragging", "");
  await zone.dispatchEvent("drop", { dataTransfer: dt });
  await expect(zone).not.toHaveAttribute("data-dragging", "");
  await expect(page.getByRole("img", { name: "dropped.png" })).toBeVisible();

  // The limit (2) holds for pasted images too.
  await page.evaluate((b64) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "image.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await expect(page.getByText("You can upload up to 2 screenshots.")).toBeVisible();
  await expect(page.getByRole("img", { name: /\.png$/ })).toHaveCount(2);
});
