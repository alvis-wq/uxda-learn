import Image from "next/image";
import type { CardSpan } from "@/lib/challenges/card";

/**
 * Width of the artwork's grid column per card size (the card sets `--img-w` with one of these): narrower cards shrink
 * the image instead of dropping it.
 */
export const ARTWORK_COLUMN: Record<CardSpan, string> = {
  wide: "[--img-w:5rem] md:[--img-w:clamp(8rem,34%,15rem)]",
  full: "[--img-w:5rem] md:[--img-w:clamp(8rem,34%,15rem)]",
  narrow: "[--img-w:5rem] md:[--img-w:clamp(4.5rem,24%,7.5rem)]",
};

/**
 * How wide the image is drawn, for `sizes`: its column at the largest width ARTWORK_COLUMN allows, plus the bleed
 * (`--pad`, 2rem from sm, and 1.25rem past the edge). Keeps the 800 px source from being sent to an 80 px column.
 */
const SIZES: Record<CardSpan, string> = {
  wide: "(min-width: 768px) 18.25rem, 8.25rem",
  full: "(min-width: 768px) 18.25rem, 8.25rem",
  narrow: "(min-width: 768px) 10.75rem, 8.25rem",
};

/**
 * Card artwork in the card's right-hand grid column: it starts at the column's left edge and grows rightwards and
 * downwards through the card's padding (`--pad`) and past its edge, so it bleeds off the bottom-right corner while the
 * text, in the other column, never sits under it. Decorative (the title says what the card is), served resized by
 * next/image and lazy-loaded, so cards below the fold cost nothing until they scroll into view.
 */
export function CardArtwork({ src, span }: { src: string; span: CardSpan }) {
  return (
    <div aria-hidden className="pointer-events-none relative self-stretch" data-testid="card-artwork">
      <Image
        src={src}
        alt=""
        width={800}
        height={800}
        sizes={SIZES[span]}
        draggable={false}
        className="absolute bottom-[calc(-1*var(--pad)-1rem)] left-0 h-auto w-[calc(100%+var(--pad)+1.25rem)] max-w-none"
      />
    </div>
  );
}
