"use client";

import { animate } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LOGIN_SEQ, LOGIN_X_DISTANCE } from "@/lib/login-sequence";
import { soundStartOffset } from "@/lib/login-sound";
import { STAGE_BACKGROUND } from "./constants";
import { GlassX } from "./glass-x";
import { LoginSoundAudio, SoundToggle, useLoginSound } from "./login-sound";
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
 * - Plays every time the login page loads (fresh visit, reload, after sign-out): there is no stored "already seen" state.
 * - Any click or key jumps to the end state. Reduced motion, a missing WebGL2, or an X that isn't ready within
 *   ~1 s skip straight to it, so signing in is never blocked.
 * - The intro sound (src/lib/login-sound.ts) is off by default; when on it starts with the sequence, fades out over ~0.3 s
 *   when the sequence is skipped, and (with reduced motion, where there is no sequence) plays only because it was turned on.
 *   A speaker button in the corner turns it on/off; turning it on mid-sequence starts it from the sequence's position.
 * - Without JavaScript the card is shown by <noscript> at once, and by a CSS animation after a few seconds if
 *   scripts fail to run (globals.css).
 */
export function LoginSequence({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const webgl2 = useSyncExternalStore(noSubscription, supportsWebGL2, () => true);
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const [phase, setPhase] = useState<Phase>("play");
  const sound = useLoginSound();
  const { play, fadeOut } = sound;
  /** performance.now() when the sequence started (the X was ready); null before it starts and after it ends. */
  const startedAt = useRef<number | null>(null);

  const canPlay = !reducedMotion && webgl2;
  const current: Phase = canPlay ? phase : "done";
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
    startedAt.current = null;
    setPhase("done");
  }, [stopAll]);
  // A click or key skips the sequence, and the sound fades out with it.
  const skip = useCallback(() => {
    fadeOut();
    finish();
  }, [fadeOut, finish]);

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
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [sceneMounted, skip]);

  // The sound follows the preference: off never plays (and stops what is playing); on with reduced motion plays at
  // once (there is no sequence); on mid-sequence starts from where the sequence is. A sequence that hasn't started
  // yet starts it itself (onReady).
  useEffect(() => {
    if (!sound.on) {
      fadeOut();
      return;
    }
    if (reducedMotion) {
      play(0);
    } else if (startedAt.current !== null) {
      const offset = soundStartOffset(performance.now() - startedAt.current);
      if (offset !== null) play(offset);
    }
  }, [sound.on, reducedMotion, play, fadeOut]);

  const onReady = useCallback(
    (scene: GlassXHandle) => {
      if (started.current) return;
      started.current = true;
      startedAt.current = performance.now();
      play(0); // when the sound is on (the sequence starts the sound; a blocked autoplay just stays silent)
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
      at(LOGIN_SEQ.xFadeAtMs + LOGIN_SEQ.xFadeMs, () => {
        startedAt.current = null;
        setPhase("done");
      });
    },
    [play],
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
      <LoginSoundAudio on={sound.on} audio={sound.audio} />
      <SoundToggle on={sound.on} onToggle={sound.toggle} />
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
