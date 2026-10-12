"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LOGIN_SOUND_KEY,
  LOGIN_SOUND_SRC,
  fadeVolume,
  parseSoundPreference,
  soundPreferenceValue,
} from "@/lib/login-sound";

// The preference lives in localStorage; this tiny store lets every reader (and other tabs) see changes. Every
// storage access is guarded: it can be missing or throw (private windows, blocked site data), and then the sound
// simply stays off.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

let memory = false; // when storage is unavailable the choice still holds for this page view
function getSnapshot(): boolean {
  try {
    return parseSoundPreference(window.localStorage.getItem(LOGIN_SOUND_KEY));
  } catch {
    return memory;
  }
}

function writePreference(on: boolean) {
  memory = on;
  try {
    window.localStorage.setItem(LOGIN_SOUND_KEY, soundPreferenceValue(on));
  } catch {
    // Not remembered; it still applies to this page view.
  }
  notify();
}

/**
 * Sound state and playback for the login page. `on` is false on the server and during hydration (so the HTML is the
 * same either way) and the stored choice afterwards. play/fadeOut are stable; they never throw and never log: a browser that
 * blocks autoplay just doesn't play it.
 */
export function useLoginSound() {
  const on = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const audio = useRef<HTMLAudioElement>(null);
  const onRef = useRef(on);
  const fade = useRef<{ stop: () => void } | undefined>(undefined);

  useEffect(() => {
    onRef.current = on;
  }, [on]);

  const stopFade = () => {
    fade.current?.stop();
    fade.current = undefined;
  };

  /** Starts the clip `offsetSeconds` in, if the sound is on. */
  const play = useCallback((offsetSeconds = 0) => {
    const el = audio.current;
    if (!el || !onRef.current) return;
    stopFade();
    try {
      el.volume = 1;
      el.currentTime = offsetSeconds;
      void el.play()?.catch(() => {}); // autoplay blocked, or the file isn't available: silently nothing
    } catch {
      // Same: nothing to report.
    }
  }, []);

  /** Fades the clip out over ~0.3 s and stops it. */
  const fadeOut = useCallback(() => {
    const el = audio.current;
    if (!el || el.paused) return;
    stopFade();
    const from = el.volume;
    const startedAt = performance.now();
    let frame = 0;
    let stopped = false;
    const tick = (now: number) => {
      if (stopped) return;
      el.volume = fadeVolume(from, now - startedAt);
      if (el.volume > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        el.pause();
        el.volume = 1;
        fade.current = undefined;
      }
    };
    fade.current = {
      stop: () => {
        stopped = true;
        cancelAnimationFrame(frame);
      },
    };
    frame = requestAnimationFrame(tick);
  }, []);

  const toggle = useCallback(() => writePreference(!getSnapshot()), []);

  // Leaving the page (or the component) ends the sound.
  useEffect(
    () => () => {
      fade.current?.stop();
      audio.current?.pause();
    },
    [],
  );

  return { on, toggle, audio, play, fadeOut };
}

/** The hidden audio element: no controls, not announced, and only preloaded when the sound is on. */
export function LoginSoundAudio({ on, audio }: { on: boolean; audio: React.RefObject<HTMLAudioElement | null> }) {
  return <audio ref={audio} src={LOGIN_SOUND_SRC} preload={on ? "auto" : "none"} aria-hidden hidden />;
}

/**
 * A small speaker button in the corner of the login page. Clicking it, or activating it with Enter/Space, is not the
 * "click or key skips the sequence" gesture (those events stop here); any other key still skips.
 */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid="sound-toggle"
      aria-label="Sound on/off"
      aria-pressed={on}
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation(); // activating the button is not a "skip" key
      }}
      className="text-foreground/80 hover:text-foreground absolute top-4 right-4 z-20 sm:top-6 sm:right-6"
    >
      {on ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
    </Button>
  );
}
