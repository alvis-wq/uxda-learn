"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Lazy: the shader and its WebGL setup stay out of the page's first bundle, and never run on the server.
const Aurora = dynamic(() => import("./Aurora"), { ssr: false });

const COLOR_STOPS = ["#00fff8", "#7438fb", "#1d0093"];

/**
 * The home page's aurora: purely decorative (hidden from assistive tech, not interactive, behind the content) and
 * additive. If WebGL2 is missing the component draws nothing and the page is exactly as without it.
 * It follows the app theme through the component's own `lightMode`, and fades out towards the bottom.
 */
const subscribe = () => () => {};

export function HeroAurora({ className }: { className?: string }) {
  // Render nothing until hydrated: the server can't know the theme, and next-themes already does on the client's
  // first render, so anything theme-dependent there would not match the server HTML.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const { resolvedTheme } = useTheme();
  return (
    <div
      aria-hidden
      data-testid="aurora"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-[600px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_86%,transparent)]",
        className,
      )}
    >
      {hydrated && resolvedTheme && (
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
      )}
    </div>
  );
}
