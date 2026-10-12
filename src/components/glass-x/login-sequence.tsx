"use client";

import { animate } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  LOGIN_SEQ,
  LOGIN_SEQ_COOKIE,
  LOGIN_X_DISTANCE,
  type LoginSequenceInitial,
} from "@/lib/login-sequence";
import { STAGE_BACKGROUND } from "./constants";
import { GlassX } from "./glass-x";
import type { GlassXHandle } from "./glass-x-scene";
import { supportsWebGL2 } from "./support";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/** play = waiting for / running the X with the card still hidden; card = card visible; out = X fading; done = end state. */
type Phase = "play" | "x" | "card" | "out" | "done";

const noSubscription = () => () => {};
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const CardInteractive = createContext(true);
/** False while the card is still hidden: its controls must not be reachable by Tab (pointer events are off in CSS too). */
export const useLoginCardInteractive = () => useContext(CardInteractive);

/**
 * The login stage: dark #101010, the glass X (see src/lib/login-sequence.ts for the timeline), then the glass card
 * over a soft violet glow. `children` is the card content; it is in the DOM from the start (screen readers can
 * reach it) and only fades in visually.
 *
 * - Plays once per browser session (cookie read by the server page, so there is no flash either way).
 * - Any click or key jumps to the end state. Reduced motion, a missing WebGL2, or an X that isn't ready within
 *   ~1 s skip straight to it, so signing in is never blocked.
 * - Without JavaScript the card is shown by <noscript> at once, and by a CSS animation after a few seconds if
 *   scripts fail to run (globals.css).
 */
export function LoginSequence({ initial, children }: { initial: LoginSequenceInitial; children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const webgl2 = useSyncExternalStore(noSubscription, supportsWebGL2, () => true);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const [phase, setPhase] = useState<Phase>(initial === "done" ? "done" : "play");

  const canPlay = initial === "play" && !reducedMotion && webgl2;
  const current: Phase = initial === "play" && !canPlay ? "done" : phase;
  const sceneMounted = canPlay && phase !== "done";

  const timers = useRef<number[]>([]);
  const zoom = useRef<{ stop: () => void } | undefined>(undefined);
  const started = useRef(false);
  const stopAll = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    zoom.current?.stop();
  }, []);
  const finish = useCallback(() => {
    stopAll();
    setPhase("done");
  }, [stopAll]);

  // Started (or skipped): not again this browser session, even on reload.
  useEffect(() => {
    if (initial === "play") document.cookie = `${LOGIN_SEQ_COOKIE}=seen; path=/; SameSite=Lax`;
  }, [initial]);

  // The X has to be ready in time, otherwise skip straight to the card.
  useEffect(() => {
    if (!canPlay) return;
    const giveUp = window.setTimeout(() => {
      if (!started.current) finish();
    }, LOGIN_SEQ.readyTimeoutMs);
    return () => {
      window.clearTimeout(giveUp);
      stopAll();
    };
  }, [canPlay, finish, stopAll]);

  // Any click or key jumps to the end state.
  useEffect(() => {
    if (!sceneMounted) return;
    window.addEventListener("keydown", finish);
    window.addEventListener("pointerdown", finish);
    return () => {
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, [sceneMounted, finish]);

  const onReady = useCallback(
    (scene: GlassXHandle) => {
      if (started.current) return;
      started.current = true;
      const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
      scene.restart();
      setPhase("x");
      at(LOGIN_SEQ.zoomAtMs, () => {
        zoom.current = animate(LOGIN_SEQ.startZoom, 1, {
          duration: LOGIN_SEQ.zoomMs / 1000,
          ease: EASE_OUT,
          onUpdate: (value) => scene.setZoom(value),
        });
      });
      at(LOGIN_SEQ.cardAtMs, () => setPhase("card"));
      at(LOGIN_SEQ.xFadeAtMs, () => setPhase("out"));
      at(LOGIN_SEQ.xFadeAtMs + LOGIN_SEQ.xFadeMs, () => setPhase("done"));
    },
    [],
  );

  const seq = current === "x" ? "play" : current;
  const xClass = current === "out" ? "login-x-out" : current === "play" ? "login-x-wait" : "login-x-in";
  // Before hydration (and without JS) the card's controls stay in the normal Tab order.
  const interactive = !hydrated || seq !== "play";

  return (
    <main
      data-seq={seq}
      className="login-stage dark text-foreground isolate relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ backgroundColor: STAGE_BACKGROUND }}
    >
      <noscript>
        <style>{".login-card-wrap{opacity:1!important;transform:none!important;pointer-events:auto!important;animation:none!important}"}</style>
      </noscript>
      <div aria-hidden className="stage-glow" />
      {sceneMounted && (
        <div aria-hidden className="login-x-box pointer-events-none">
          <GlassX
            eager
            fallback={false}
            autoplay={false}
            replayOnClick={false}
            distance={LOGIN_X_DISTANCE}
            maxPixelRatio={1.5}
            zoom={LOGIN_SEQ.startZoom}
            className="w-full"
            canvasClassName={`login-x ${xClass}`}
            onReady={onReady}
            onFail={finish}
          />
        </div>
      )}
      <CardInteractive.Provider value={interactive}>
        <div className="login-card-wrap relative z-10 grid w-full max-w-sm gap-6">{children}</div>
      </CardInteractive.Provider>
    </main>
  );
}
