"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { AURORA_BOX, GLOW_MIDLINE } from "./geometry";

// Lazy: the shader and its WebGL setup stay out of the page's first bundle, and never run on the server.
const Aurora = dynamic(() => import("./Aurora"), { ssr: false });

const COLOR_STOPS = ["#00fff8", "#7438fb", "#1d0093"];

const subscribe = () => () => {};

/**
 * The home page's aurora: fixed to the viewport, behind everything, decorative and not interactive.
 *
 * The glow's horizontal middle line (GLOW_MIDLINE) sits exactly on the bottom edge of the viewport, so only the upper
 * half of the glow is visible, rising from the bottom. It stays put while the page scrolls.
 *
 * It is portalled into <body>: the page-entry animation puts transforms on the page's wrapper, and a transformed
 * ancestor would turn `position: fixed` into "fixed to that ancestor" and trap `z-index`. Rendered nothing until
 * hydrated (the server can't know the theme; next-themes does on the client's first render), and nothing is drawn
 * without WebGL2, so the page is exactly as without it.
 */
export function PageAurora() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme } = useTheme();
  if (!hydrated || !resolvedTheme) return null;

  return createPortal(
    <div
      aria-hidden
      data-testid="aurora"
      style={{ "--aurora-h": `clamp(${AURORA_BOX.min}px, ${AURORA_BOX.vh}vh, ${AURORA_BOX.max}px)`, "--midline": GLOW_MIDLINE } as React.CSSProperties}
      // The box's bottom edge is GLOW_MIDLINE of its height below the viewport's bottom edge.
      className="pointer-events-none fixed inset-x-0 -z-10 h-(--aurora-h) bottom-[calc(var(--aurora-h)*var(--midline)*-1)] overflow-hidden"
    >
      <Aurora
        colorStops={COLOR_STOPS}
        amplitude={1}
        blend={0.5}
        height={0.18}
        speed={0.8}
        glow={1.95}
        scale={0.75}
        brightness={1.5}
        direction="bottom"
        opacity={0.95}
        mouseInteraction={false}
        lightMode={resolvedTheme === "light"}
      />
    </div>,
    document.body,
  );
}
