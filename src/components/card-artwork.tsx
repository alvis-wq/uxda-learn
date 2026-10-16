import Image from "next/image";
import type { CardSpan } from "@/lib/challenges/card";
import type { ImageTuning } from "@/lib/content/transform";

/**
 * Sets `--art`, the illustration's width, on a card. The card must be a size container (`@container`): the width is
 * a share of the card's own width (`cqw`), so it follows the card, not the viewport.
 *
 * - Large cards (full width on desktop, and every card from md to lg, where the grid is one column): 18.25rem.
 * - Grid cards (lg+): 45% of the card, so the object reads clearly.
 * - Mobile (one column, below md): 40% of the card.
 */
export const ARTWORK_SIZE: Record<CardSpan, string> = {
  wide: "[--art:40cqw] md:[--art:18.25rem] lg:[--art:45cqw]",
  narrow: "[--art:40cqw] md:[--art:18.25rem] lg:[--art:45cqw]",
  full: "[--art:40cqw] md:[--art:18.25rem]",
};

/**
 * Largest width the image is drawn at, for `sizes` (see ARTWORK_SIZE): 18.25rem from md (45% of a wide grid card is
 * less), 45% of a narrow grid card (≤ 11.5rem), and 40% of the card below md.
 */
const SIZES: Record<CardSpan, string> = {
  wide: "(min-width: 768px) 18.25rem, 40vw",
  narrow: "(min-width: 1024px) 11.5rem, (min-width: 768px) 18.25rem, 40vw",
  full: "(min-width: 768px) 18.25rem, 40vw",
};

/**
 * The fade that keeps text readable where it crosses the illustration: fully visible in the bottom-right corner,
 * transparent towards the top-left. On the image itself: nothing is painted behind the text. A gentle fade on
 * purpose: on an extreme card (a long badge row on a wide grid card) text can still cross an opaque part of the object
 * — accepted, see DECISIONS.md.
 */
const FADE = "radial-gradient(circle at 100% 100%, #000 30%, transparent 85%)";

/** `sizes` for a tuned illustration: every width multiplied by its scale. */
export function scaledSizes(sizes: string, scale: number): string {
  if (scale === 1) return sizes;
  return sizes.replace(/(\d+(?:\.\d+)?)(rem|vw)/g, (_, n: string, unit: string) => `${+(Number(n) * scale).toFixed(2)}${unit}`);
}

/**
 * A card's illustration as a true background: absolutely positioned, flush with the card's bottom and right edges, so
 * the 800×800 frame (drawn to be cropped there) bleeds off both and is clipped by the rounded corner, and underneath
 * everything else (`-z-10` inside the card's `isolate`). It never affects the layout: the card's content is laid out
 * as if there were no image, and the fade (FADE) keeps the text that crosses it readable. Decorative (the title says
 * what the card is), served resized by next/image and lazy-loaded.
 *
 * `tuning` adjusts one illustration by hand, like in Figma: `image_scale` multiplies its width (still anchored
 * bottom-right) and `image_offset_x` / `image_offset_y` move it by a % of its own size (right / down). The fade moves
 * with it.
 */
export function CardArtwork({ src, span, tuning }: { src: string; span: CardSpan; tuning: ImageTuning }) {
  const { image_scale: scale, image_offset_x: x, image_offset_y: y } = tuning;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={800}
      height={800}
      sizes={scaledSizes(SIZES[span], scale)}
      draggable={false}
      data-testid="card-artwork"
      style={{
        maskImage: FADE,
        WebkitMaskImage: FADE,
        width: scale === 1 ? undefined : `calc(var(--art) * ${scale})`,
        transform: x || y ? `translate(${x}%, ${y}%)` : undefined,
      }}
      className="pointer-events-none absolute right-0 bottom-0 -z-10 h-auto w-[var(--art)] max-w-none select-none"
    />
  );
}
