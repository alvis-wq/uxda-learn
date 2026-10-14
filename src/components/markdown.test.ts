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

describe("Markdown side images", () => {
  const md = 'What to do:\n\n- One\n- Two\n\n![The sidebar](/challenges/claude-code-sidebar.png "side")\n\nAfter.';
  const html = render(md);
  const row = html.match(/<div class="[^"]*md:flex-row[^"]*" data-testid="brief-side-row">([\s\S]*?)<p>After\.<\/p>/)?.[1] ?? "";

  it("puts a side image and the block before it in one row: side by side from 768 px, stacked below", () => {
    expect(html).toContain('data-testid="brief-side-row"');
    expect(html).toMatch(/class="my-6 flex flex-col gap-4 md:flex-row md:items-start md:gap-8"/);
    expect(row).toContain("<li>One</li>");
    // The text comes first, so a narrow screen shows the image under it; the image column is about 40% wide.
    expect(row.indexOf("<ul>")).toBeLessThan(row.indexOf("<img"));
    expect(row).toMatch(/<div class="m-0 md:w-2\/5 md:shrink-0">/);
    expect(row.match(/<img[^>]*>/)?.[0]).toContain("data-side");
  });

  it("leaves the text before the row, and an ordinary image, as they were", () => {
    expect(html.indexOf("<p>What to do:</p>")).toBeLessThan(html.indexOf("brief-side-row"));
    const plain = render("Text.\n\n![The sidebar](/challenges/claude-code-sidebar.png)");
    expect(plain).not.toContain("brief-side-row");
    expect(plain.match(/<img[^>]*>/)?.[0]).not.toContain("data-side");
  });

  it("doesn't pass the title on to the page", () => {
    expect(html).not.toContain('title="side"');
  });
});

describe("Markdown image lightbox", () => {
  const html = render("![The Claude Code sidebar](/challenges/claude-code-sidebar.png)");

  it("makes every brief image a button named by its alt text that opens it larger", () => {
    const button = html.match(/<button[^>]*data-testid="brief-image-open"[^>]*>([\s\S]*?)<\/button>/);
    expect(button?.[0]).toContain('type="button"');
    expect(button?.[0]).toContain('aria-haspopup="dialog"');
    expect(button?.[0]).toContain('aria-expanded="false"');
    expect(button?.[1]).toContain('alt="The Claude Code sidebar"');
    expect(button?.[1]).toContain('<span class="sr-only"> (open larger)</span>');
  });

  it("renders the large view only once opened", () => {
    expect(html).not.toContain("brief-image-dialog");
  });
});
