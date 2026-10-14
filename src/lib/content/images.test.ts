import { describe, expect, it } from "vitest";
import { deriveSummary } from "./transform";
import { briefImageErrors, isBriefImageSrc, markdownImages } from "./images";

describe("brief images", () => {
  it("finds markdown images, with or without a title", () => {
    expect(markdownImages('A ![One](/challenges/a.png) and ![](/challenges/b.webp "Title") and [a link](/x).')).toEqual([
      { alt: "One", src: "/challenges/a.png", title: null, index: 2, raw: "![One](/challenges/a.png)" },
      { alt: "", src: "/challenges/b.webp", title: "Title", index: 32, raw: '![](/challenges/b.webp "Title")' },
    ]);
  });

  it("only accepts files in public/challenges/", () => {
    expect(isBriefImageSrc("/challenges/claude-code-sidebar.png")).toBe(true);
    for (const src of ["challenges/a.png", "/challenges/sub/a.png", "/challenges/A.PNG", "https://x.y/a.png", "/challenges/a.gif"]) {
      expect(isBriefImageSrc(src), src).toBe(false);
    }
  });

  it("requires alt text, the right folder and an existing file", () => {
    const exists = (f: string) => f === "here.png";
    expect(briefImageErrors("![Sidebar](/challenges/here.png)", exists)).toEqual([]);
    expect(briefImageErrors("![](/challenges/here.png)", exists)).toEqual([
      'image "/challenges/here.png": needs alt text — ![what the image shows](/challenges/here.png)',
    ]);
    expect(briefImageErrors("![Gone](/challenges/gone.png)", exists)).toEqual(['image "/challenges/gone.png" not found in public/challenges/']);
    expect(briefImageErrors("![Far](https://x.y/a.png)", exists)[0]).toMatch(/use a file in public\/challenges\//);
  });

  it("accepts a side image on its own line after some text", () => {
    const exists = () => true;
    expect(briefImageErrors('- One\n- Two\n\n![Sidebar](/challenges/a.png "side")\n\nMore.', exists)).toEqual([]);
    expect(briefImageErrors("Text.\n\n![Sidebar](/challenges/a.png 'side')", exists)).toEqual([]);
  });

  it("rejects any other title, and a side image that can't sit next to text", () => {
    const exists = () => true;
    expect(briefImageErrors('Text.\n\n![Sidebar](/challenges/a.png "Side")', exists)).toEqual([
      'image "/challenges/a.png": unknown title "Side" — leave it out, or use "side" to show the image next to the text before it',
    ]);
    expect(briefImageErrors('![Sidebar](/challenges/a.png "side")\n\nText.', exists)).toEqual([
      'image "/challenges/a.png": a "side" image needs text before it to sit next to',
    ]);
    const ownLine = 'image "/challenges/a.png": a "side" image goes on a line of its own, with an empty line before and after it';
    expect(briefImageErrors('Text.\n\nSee ![Sidebar](/challenges/a.png "side") here.', exists)).toEqual([ownLine]);
    // Without an empty line, markdown joins it to the list item or paragraph around it.
    expect(briefImageErrors('- One\n![Sidebar](/challenges/a.png "side")', exists)).toEqual([ownLine]);
    expect(briefImageErrors('Text.\n\n![Sidebar](/challenges/a.png "side")\nMore.', exists)).toEqual([ownLine]);
  });

  it("leaves images out of a derived summary", () => {
    expect(deriveSummary("![Sidebar](/challenges/a.png)\n\nOpen each folder.")).toBe("Open each folder.");
    expect(deriveSummary("See ![x](/challenges/a.png) this.")).toBe("See this.");
  });
});
