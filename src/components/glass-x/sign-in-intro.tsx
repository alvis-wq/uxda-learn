"use client";

import { useEffect, useState } from "react";
import { INTRO_COOKIE, INTRO_LEAVE_MS, INTRO_MAX_MS, INTRO_SPEED } from "@/lib/intro";
import { STAGE_BACKGROUND } from "./constants";
import { GlassX } from "./glass-x";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type Phase = "playing" | "leaving" | "done";

/**
 * Full-screen glass X splash right after sign-in. Rendered by SignInIntroGate only while the
 * session's intro is pending. Lasts at most INTRO_MAX_MS; a click, tap or key skips it. The app
 * is already rendered underneath, so nothing waits on it. With reduced motion it never shows.
 */
export function SignInIntro() {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("playing");

  // Played (or skipped): never again this browser session, even on reload.
  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=seen; path=/; SameSite=Lax`;
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const skip = () => setPhase((current) => (current === "playing" ? "leaving" : current));
    const end = setTimeout(() => setPhase("done"), INTRO_MAX_MS);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(end);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const gone = setTimeout(() => setPhase("done"), INTRO_LEAVE_MS);
    return () => clearTimeout(gone);
  }, [phase]);

  if (reducedMotion || phase === "done") return null;

  return (
    // `dark` so the hint text uses the dark-theme tokens even in light mode. The CSS animation
    // (globals.css) also fades it out by itself at INTRO_MAX_MS, so it can never trap the app.
    <div
      aria-hidden
      data-testid="sign-in-intro"
      data-leaving={phase === "leaving" ? "" : undefined}
      className="sign-in-intro dark fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: STAGE_BACKGROUND }}
    >
      <GlassX eager speed={INTRO_SPEED} replayOnClick={false} className="w-[min(78vmin,720px)]" />
      <p className="text-muted-foreground text-meta absolute inset-x-0 bottom-8 text-center">Click or press any key to skip</p>
    </div>
  );
}
