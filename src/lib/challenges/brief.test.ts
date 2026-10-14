import { describe, expect, it } from "vitest";
import { briefView, stripLeadingTitle } from "./brief";

describe("stripLeadingTitle", () => {
  it("drops a leading heading that repeats the title", () => {
    expect(stripLeadingTitle("## How we work together\nHow do we talk?\n\nMore.", "How we work together")).toBe("How do we talk?\n\nMore.");
  });

  it("matches loosely: level, case, punctuation, emphasis, extra spaces, closing hashes", () => {
    for (const h of ["# our dna — 7 values", "### Our DNA - 7 Values ###", "## **Our DNA — 7 values**", "##   Our  DNA: 7 values!"]) {
      expect(stripLeadingTitle(`${h}\nBody.`, "Our DNA — 7 values"), h).toBe("Body.");
    }
  });

  it("skips blank lines before the heading and after it", () => {
    expect(stripLeadingTitle("\n\n## Who's the hero?\n\n\nEveryone has one.", "Who's the hero?")).toBe("Everyone has one.");
  });

  it("keeps a heading that is not the title, and a title that is not first", () => {
    expect(stripLeadingTitle("## The brief\nText", "Quick draft")).toBe("## The brief\nText");
    expect(stripLeadingTitle("Intro line\n## Quick draft\nText", "Quick draft")).toBe("Intro line\n## Quick draft\nText");
  });

  it("only removes the first heading, once", () => {
    expect(stripLeadingTitle("## A\n## A\nText", "A")).toBe("## A\nText");
  });

  it("keeps a paragraph that merely starts with the title, and a heading whose text only contains it", () => {
    expect(stripLeadingTitle("Quick draft is the first one.", "Quick draft")).toBe("Quick draft is the first one.");
    expect(stripLeadingTitle("## Quick draft with the Make Kit\nText", "Quick draft")).toBe("## Quick draft with the Make Kit\nText");
  });

  it("handles an empty brief", () => {
    expect(stripLeadingTitle("", "T")).toBe("");
    expect(stripLeadingTitle("  \n \n", "T")).toBe("  \n \n");
  });
});

describe("briefView", () => {
  it("takes the first paragraph and says there is more", () => {
    const view = briefView("## T\nFirst line\nstill first.\n\nSecond.\n\n6 questions.", "T");
    expect(view).toEqual({ body: "First line\nstill first.\n\nSecond.\n\n6 questions.", first: "First line\nstill first.", hasMore: true });
  });

  it("a one-paragraph brief has nothing to collapse", () => {
    expect(briefView("## T\nJust this.", "T")).toMatchObject({ first: "Just this.", hasMore: false });
  });

  it("skips headings before the first paragraph", () => {
    const view = briefView("## T\n### The brief\n\nA banking app.\n\n### What to do\n1. Open it.", "T");
    expect(view.first).toBe("A banking app.");
    expect(view.hasMore).toBe(true);
  });

  it("keeps a fenced code block whole, blank lines and all", () => {
    const view = briefView("```\nline 1\n\nline 2\n```\n\nAfter.", "T");
    expect(view.first).toBe("```\nline 1\n\nline 2\n```");
    expect(view.hasMore).toBe(true);
  });

  it("a brief that is only headings has nothing to collapse", () => {
    expect(briefView("## T\n### Only a heading", "T")).toMatchObject({ hasMore: false });
  });

  it("the real wireframing brief starts with its time line", () => {
    const view = briefView("## Quick draft with the Make Kit\n**Time:** about 20 minutes\n\n**The brief:** a banking app.\n\n### What to do", "Quick draft with the Make Kit");
    expect(view.first).toBe("**Time:** about 20 minutes");
  });
});
