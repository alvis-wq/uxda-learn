import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ARTWORK_TEXT_WIDTH, scaledSizes } from "./card-artwork";

describe("scaledSizes", () => {
  it("multiplies every width by the illustration's scale and leaves the media queries alone", () => {
    const sizes = "(min-width: 1024px) 11.5rem, (min-width: 768px) 18.25rem, 40vw";
    expect(scaledSizes(sizes, 1)).toBe(sizes);
    expect(scaledSizes(sizes, 1.2)).toBe("(min-width: 1024px) 13.8rem, (min-width: 768px) 21.9rem, 48vw");
    expect(scaledSizes(sizes, 0.5)).toBe("(min-width: 1024px) 5.75rem, (min-width: 768px) 9.13rem, 20vw");
  });
});

describe("card illustrations", () => {
  const source = readFileSync(path.resolve(__dirname, "card-artwork.tsx"), "utf8");

  it("are fully opaque: no mask or fade", () => {
    expect(source).not.toMatch(/mask-?image|maskImage|opacity/i);
  });

  it("narrow the text block only on full-width cards: 60% from md to lg (all cards), 70% on desktop's full-width cards", () => {
    expect(ARTWORK_TEXT_WIDTH).toEqual({
      wide: "md:max-w-[60%] lg:max-w-none",
      narrow: "md:max-w-[60%] lg:max-w-none",
      full: "md:max-w-[60%] lg:max-w-[70%]",
    });
  });
});

