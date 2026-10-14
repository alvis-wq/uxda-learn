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

  it("keeps links into the app in the same tab, with no icon", () => {
    for (const href of ["/challenges/wf-1-make-kit-quick-draft", "/categories/wireframing", "#rubric", "?category=ai-workflow"]) {
      const local = render(`[Go](${href})`);
      expect(local, href).toContain(`href="${href}"`);
      expect(local, href).not.toContain("target=");
      expect(local, href).not.toContain("rel=");
      expect(local, href).not.toContain("<svg");
      expect(local, href).not.toContain("opens in a new tab");
    }
  });

  it("treats other hosts as external, including a protocol-relative link", () => {
    for (const href of ["//evil.example/x", "https://www.figma.com/file/1", "http://example.com", "mailto:a@b.co"]) {
      expect(render(`[Go](${href})`), href).toContain('target="_blank"');
    }
  });
});

describe("Markdown images", () => {
  it("shows an image from public/challenges/ with its alt text, responsive and lazy", () => {
    const html = render("Like this:\n\n![The Claude Code sidebar with three folders](/challenges/claude-code-sidebar.png)");
    const img = html.match(/<img[^>]*>/)?.[0] ?? "";
    expect(img).toContain('src="/challenges/claude-code-sidebar.png"');
    expect(img).toContain('alt="The Claude Code sidebar with three folders"');
    expect(img).toContain('loading="lazy"');
    expect(img).toMatch(/class="[^"]*max-w-full[^"]*h-auto|class="[^"]*h-auto[^"]*max-w-full/);
  });

  it("shows nothing for an image from anywhere else", () => {
    for (const src of ["https://evil.example/x.png", "/other/x.png", "/challenges/../x.png", "/challenges/x.svg"]) {
      expect(render(`![x](${src})`), src).not.toContain("<img");
    }
  });
});
