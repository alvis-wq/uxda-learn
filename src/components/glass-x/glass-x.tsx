"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { GlassXViewProps } from "./glass-x-view";

// Client-only: the server renders just the empty square, so nothing WebGL-related runs or ships with the page.
const GlassXView = dynamic(() => import("./glass-x-view"), { ssr: false });

interface GlassXProps extends Partial<Omit<GlassXViewProps, "speed" | "replayOnClick" | "eager" | "fallback" | "autoplay">> {
  /** Size the square with width (e.g. `w-[min(80vmin,720px)]`); the X keeps a 1:1 box. */
  className?: string;
  /** Playback rate of the 4 s reveal (1 = as designed). */
  speed?: number;
  /** Clicking the X plays the reveal again. */
  replayOnClick?: boolean;
  /** Load three and the model immediately instead of when the browser is idle. */
  eager?: boolean;
  /** Show the static image when the live X can't run (default true). */
  fallback?: boolean;
  /** false: the reveal waits for handle.restart() (see onReady). Default true. */
  autoplay?: boolean;
}

/**
 * The animated glass X on the dark stage colour. Decorative (hidden from assistive tech).
 * Place it on a STAGE_BACKGROUND surface that creates its own stacking context (`isolate`, `fixed`, ...)
 * so the canvas blends with that colour; it falls back to a static image whenever WebGL can't run.
 */
export function GlassX({
  className,
  speed = 1,
  replayOnClick = true,
  eager = false,
  fallback = true,
  autoplay = true,
  ...rest
}: GlassXProps) {
  return (
    <div aria-hidden className={cn("relative aspect-square", className)}>
      <GlassXView speed={speed} replayOnClick={replayOnClick} eager={eager} fallback={fallback} autoplay={autoplay} {...rest} />
    </div>
  );
}
