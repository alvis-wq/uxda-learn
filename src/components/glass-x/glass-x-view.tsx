"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FALLBACK_IMAGE } from "./constants";
import { supportsWebGL2, whenIdle } from "./support";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import type { GlassXHandle } from "./glass-x-scene";

export interface GlassXViewProps {
  speed: number;
  replayOnClick: boolean;
  /** Start loading right away instead of when the browser is idle (for the sign-in intro). */
  eager: boolean;
}

const noSubscription = () => () => {};

/**
 * The live X, or the static settled image when motion is reduced, WebGL2 is missing, the model
 * fails to load or the GPU context is lost. Loaded through next/dynamic (ssr: false) from glass-x.tsx;
 * three itself is a second lazy chunk, fetched after the page is idle, so neither blocks the app.
 */
export default function GlassXView({ speed, replayOnClick, eager }: GlassXViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webgl2 = useSyncExternalStore(noSubscription, supportsWebGL2, () => true);
  const [failed, setFailed] = useState(false);
  const live = !reducedMotion && webgl2 && !failed;

  useEffect(() => {
    const el = host.current;
    if (!live || !el) return;
    let cancelled = false;
    let handle: GlassXHandle | undefined;

    const start = async () => {
      try {
        const { mountGlassX } = await import("./glass-x-scene");
        if (cancelled) return;
        const mounted = await mountGlassX(el, { speed, replayOnClick });
        if (cancelled) {
          mounted.dispose(); // unmounted while the model was loading
          return;
        }
        handle = mounted;
        mounted.renderer.domElement.addEventListener("webglcontextlost", () => setFailed(true));
      } catch (error) {
        console.warn("[glass-x] showing the static image instead:", error);
        if (!cancelled) setFailed(true);
      }
    };

    let cancelIdle = () => {};
    if (eager) void start();
    else cancelIdle = whenIdle(() => void start());

    return () => {
      cancelled = true;
      cancelIdle();
      handle?.dispose();
    };
  }, [live, speed, replayOnClick, eager]);

  if (!live) {
    return (
      <Image
        src={FALLBACK_IMAGE}
        alt=""
        fill
        loading="eager"
        unoptimized
        draggable={false}
        className="animate-in fade-in object-contain duration-500 select-none"
      />
    );
  }
  // Rendered on black, screen-blended onto the stage colour behind it (see constants.ts and globals.css).
  return <div ref={host} className="glass-x-canvas size-full" />;
}
