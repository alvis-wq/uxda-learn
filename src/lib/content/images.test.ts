import { describe, expect, it } from "vitest";
import { deriveSummary } from "./transform";
import { briefImageErrors, isBriefImageSrc, markdownImages } from "./images";

describe("brief images", () => {
  it("finds markdown images, with or without a title", () => {
    expect(markdownImages('A ![One](/challenges/a.png) and ![](/challenges/b.webp "Title") and [a link](/x).')).toEqual([
      { alt: "One", src: "/challenges/a.png" },
      { alt: "", src: "/challenges/b.webp" },
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

  it("leaves images out of a derived summary", () => {
    expect(deriveSummary("![Sidebar](/challenges/a.png)\n\nOpen each folder.")).toBe("Open each folder.");
    expect(deriveSummary("See ![x](/challenges/a.png) this.")).toBe("See this.");
  });
});
