"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { FALLBACK_IMAGE } from "./constants";
import { supportsWebGL2, whenIdle } from "./support";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import type { GlassXHandle, GlassXOptions } from "./glass-x-scene";

export interface GlassXViewProps {
  speed: number;
  replayOnClick: boolean;
  /** Start loading right away instead of when the browser is idle. */
  eager: boolean;
  /** Show the static image when the live X can't run (default). With false: render nothing and call onFail. */
  fallback: boolean;
  /** Camera distance override (a bigger container needs a bigger distance for the same X size). */
  distance?: number;
  /** Initial magnification (see setZoom on the handle). */
  zoom?: number;
  /** devicePixelRatio cap for this canvas (default 2). */
  maxPixelRatio?: number;
  /** false: the reveal waits for handle.restart(). */
  autoplay: boolean;
  /** Extra classes on the canvas host (it carries the screen blend, so opacity/filter animations go here). */
  canvasClassName?: string;
  /** The model is loaded and the first frame is drawn. */
  onReady?: (handle: GlassXHandle) => void;
  /** WebGL2 missing, the model failed to load, or the GPU context was lost. */
  onFail?: () => void;
}

const noSubscription = () => () => {};

/**
 * The live X, or (by default) the static settled image when motion is reduced, WebGL2 is missing, the
 * model fails to load or the GPU context is lost. Loaded through next/dynamic (ssr: false) from glass-x.tsx;
 * three itself is a second lazy chunk, fetched after the page is idle (or at once when `eager`), so neither
 * blocks the app. Unmounting disposes the renderer and releases the WebGL context.
 */
export default function GlassXView({
  speed,
  replayOnClick,
  eager,
  fallback,
  distance,
  zoom,
  maxPixelRatio,
  autoplay,
  canvasClassName,
  onReady,
  onFail,
}: GlassXViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webgl2 = useSyncExternalStore(noSubscription, supportsWebGL2, () => true);
  const [failed, setFailed] = useState(false);
  const live = !reducedMotion && webgl2 && !failed;

  const callbacks = useRef({ onReady, onFail });
  useEffect(() => {
    callbacks.current = { onReady, onFail };
  });
  const initial = useRef({ distance, zoom, maxPixelRatio });

  // Without WebGL2 (or with reduced motion) the live X never starts; tell the caller so it doesn't wait for it.
  const unavailable = !webgl2 || reducedMotion;
  useEffect(() => {
    if (unavailable && !fallback) callbacks.current.onFail?.();
  }, [unavailable, fallback]);

  useEffect(() => {
    const el = host.current;
    if (!live || !el) return;
    let cancelled = false;
    let handle: GlassXHandle | undefined;

    const start = async () => {
      try {
        const { mountGlassX } = await import("./glass-x-scene");
        if (cancelled) return;
        const options: Partial<GlassXOptions> = { speed, replayOnClick, autoplay };
        if (initial.current.distance !== undefined) options.distance = initial.current.distance;
        if (initial.current.zoom !== undefined) options.zoom = initial.current.zoom;
        if (initial.current.maxPixelRatio !== undefined) options.maxPixelRatio = initial.current.maxPixelRatio;
        const mounted = await mountGlassX(el, options);
        if (cancelled) {
          mounted.dispose(); // unmounted while the model was loading
          return;
        }
        handle = mounted;
        mounted.renderer.domElement.addEventListener("webglcontextlost", () => {
          setFailed(true);
          callbacks.current.onFail?.();
        });
        callbacks.current.onReady?.(mounted);
      } catch (error) {
        console.warn("[glass-x] the live X is unavailable:", error);
        if (cancelled) return;
        setFailed(true);
        callbacks.current.onFail?.();
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
  }, [live, speed, replayOnClick, eager, autoplay]);

  if (!live) {
    if (!fallback) return null;
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
  return <div ref={host} className={cn("glass-x-canvas size-full", canvasClassName)} />;
}
