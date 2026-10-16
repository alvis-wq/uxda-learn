import { describe, expect, it } from "vitest";
import { scaledSizes } from "./card-artwork";

describe("scaledSizes", () => {
  it("multiplies every width by the illustration's scale and leaves the media queries alone", () => {
    const sizes = "(min-width: 1024px) 11.5rem, (min-width: 768px) 18.25rem, 40vw";
    expect(scaledSizes(sizes, 1)).toBe(sizes);
    expect(scaledSizes(sizes, 1.2)).toBe("(min-width: 1024px) 13.8rem, (min-width: 768px) 21.9rem, 48vw");
    expect(scaledSizes(sizes, 0.5)).toBe("(min-width: 1024px) 5.75rem, (min-width: 768px) 9.13rem, 20vw");
  });
});
