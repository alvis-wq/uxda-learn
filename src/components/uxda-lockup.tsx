import type { ReactNode } from "react";
import { UxdaLogo, LOGO_LETTER_BASE } from "@/components/uxda-logo";
import { cn } from "@/lib/utils";

/**
 * The logo with the word "Learn" next to it, on one baseline: the baseline of "Learn" is the line the logo's letters stand on.
 *
 * No pixel nudge: the row is `align-items: baseline`. An SVG's baseline is its bottom edge, and the word's is its own text
 * baseline, so the browser puts them together from the font's metrics at any size. Two details make that exact:
 *  - the word has `line-height: 0`, so its box is zero-height: it adds nothing above or below the logo, and the row is
 *    exactly as tall as the logo (the lockup stays centred where the logo alone was);
 *  - the letters' flat bottoms are a hair above the SVG's bottom edge (the U overshoots, see LOGO_LETTER_BASE), so the
 *    SVG moves down by that same fraction of its own height (a percentage `translateY` is relative to the element's
 *    height, so it holds at every logo size).
 * Size the logo with a height class (`h-5`); the word takes its size from `learnClassName` / the surrounding text.
 */
export function UxdaLockup({
  className,
  logoClassName,
  learnClassName,
  children = "Learn",
}: {
  className?: string;
  logoClassName?: string;
  learnClassName?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <UxdaLogo className={logoClassName} style={{ transform: `translateY(${((1 - LOGO_LETTER_BASE) * 100).toFixed(3)}%)` }} />
      <span aria-hidden className={cn("leading-[0]", learnClassName)}>
        {children}
      </span>
    </span>
  );
}
