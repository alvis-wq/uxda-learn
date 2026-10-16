import Image from "next/image";
import type { CardSpan } from "@/lib/challenges/card";

/**
 * Sets `--art`, the illustration's width, on a card. The card must be a size container (`@container`): the width is
 * a share of the card's own width (`cqw`), so it follows the card, not the viewport.
 *
 * - Large cards (full width on desktop, and every card from md to lg, where the grid is one column): 18.25rem.
 * - Grid cards (lg+): about half the card, so the object reads clearly: 48% of a wide card, 45% of a narrow one.
 * - Mobile (one column, below md): a third of the card.
 *
 * Whatever the target, it is capped so the text column (`--text-min`) always fits beside it: on a card too narrow for
 * both, the illustration shrinks, never the text into it.
 */
export const ARTWORK_SIZE: Record<CardSpan, string> = {
  wide: "[--art-target:34cqw] md:[--art-target:18.25rem] lg:[--art-target:48cqw]",
  narrow: "[--art-target:34cqw] md:[--art-target:18.25rem] lg:[--art-target:45cqw]",
  full: "[--art-target:34cqw] md:[--art-target:18.25rem]",
};

/** Shared by every span: the gap between text and illustration, the narrowest the text may get, and `--art` itself. */
export const ARTWORK_VARS =
  "[--art-gap:0.75rem] [--text-min:11rem] [--art:min(var(--art-target),calc(100cqw_-_var(--pad)_-_var(--art-gap)_-_var(--text-min)))]";

/** Right padding for a card's content when it has an illustration: everything stays left of it. */
export const ARTWORK_CLEARANCE = "pr-[calc(var(--art)_+_var(--art-gap))]";

/**
 * Largest width the image is drawn at, for `sizes` (see ARTWORK_SIZE): 18.25rem from md (a wide grid card's 48% is
 * less), 45% of a narrow grid card (≤ 11.5rem), and a third of the card below md.
 */
const SIZES: Record<CardSpan, string> = {
  wide: "(min-width: 768px) 18.25rem, 34vw",
  narrow: "(min-width: 1024px) 11.5rem, (min-width: 768px) 18.25rem, 34vw",
  full: "(min-width: 768px) 18.25rem, 34vw",
};

/**
 * A card's illustration as a background layer: flush with the card's bottom and right edges, so the 800×800 frame
 * (drawn to be cropped there) bleeds off both and is clipped by the rounded corner, and underneath everything else
 * (`-z-10` inside the card's `isolate`). The card keeps its content left of it with ARTWORK_CLEARANCE. Decorative
 * (the title says what the card is), served resized by next/image and lazy-loaded.
 */
export function CardArtwork({ src, span }: { src: string; span: CardSpan }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={800}
      height={800}
      sizes={SIZES[span]}
      draggable={false}
      data-testid="card-artwork"
      className="pointer-events-none absolute right-0 bottom-0 -z-10 h-auto w-[var(--art)] max-w-none select-none"
    />
  );
}
