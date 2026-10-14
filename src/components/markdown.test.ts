import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, null, md));

describe("Markdown links", () => {
  const html = render("Read [the doc](https://docs.google.com/document/d/abc) first.");

  it("open in a new tab, safely", () => {
    expect(html).toMatch(/<a href="https:\/\/docs\.google\.com\/document\/d\/abc" target="_blank" rel="noopener noreferrer">/);
  });

  it("show an external-link icon that screen readers skip, and say it opens in a new tab", () => {
    const svg = html.match(/<svg[^>]*>/)?.[0] ?? "";
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("lucide-external-link");
    expect(html).toContain('<span class="sr-only"> (opens in a new tab)</span>');
  });

  it("keeps the link text as the link's name", () => {
    expect(html).toContain("the doc");
  });

  it("leaves in-page links alone", () => {
    const local = render("[Jump](#rubric)");
    expect(local).toContain('<a href="#rubric">Jump</a>');
    expect(local).not.toContain("target=");
  });
});
