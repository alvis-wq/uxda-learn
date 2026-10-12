import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { default: PageEntry } = await import("./page-entry");

describe("page entry SSR output", () => {
  const html = renderToString(
    createElement(PageEntry, null, createElement("main", { "data-testid": "page-root" }, createElement("h1", null, "Home"), createElement("section", null, "Content"))),
  );

  it("renders the content in its final, visible state: no hidden / animated styles for the server", () => {
    expect(html).toContain("Content");
    expect(html).not.toMatch(/opacity\s*:\s*0/i);
    expect(html).not.toMatch(/blur\(/i);
    expect(html).not.toMatch(/translate/i);
    expect(html).not.toMatch(/style=/i); // the template adds no inline styles at all
  });

  it("only wraps the content in a layout-neutral element", () => {
    expect(html).toMatch(/^<div class="contents">/);
  });
});
