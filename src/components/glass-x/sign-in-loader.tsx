"use client";

import { useEffect, useState } from "react";
import { INTRO_COOKIE, LOADER_FADE_MS, LOADER_FADE_REDUCED_MS, loaderFadeDelay } from "@/lib/intro";
import { STAGE_BACKGROUND } from "./constants";
import { GlassX } from "./glass-x";
import { pageReady } from "./page-ready";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type Phase = "showing" | "leaving" | "done";

/**
 * The loader shown right after sign-in, while the app's first page loads. Rendered by SignInLoaderGate in the
 * first HTML only while this session's loader is pending (so the app never flashes underneath).
 *
 * - Shows the glass X on the dark stage with a violet glow, for at least LOADER_MIN_MS so it doesn't flash.
 * - There is no maximum: it fades out as soon as the page is ready (document loaded, no loading skeleton left).
 * - A click or key skips it. A CSS backstop (globals.css) clears it after a very long time if scripts never run.
 * - Reduced motion: no X, just the dark stage and a quick fade. Without WebGL2 the static image stands in.
 */
export function SignInLoader() {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("showing");

  // Shown (or skipped): never again this browser session, even on reload.
  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=seen; path=/; SameSite=Lax`;
  }, []);

  useEffect(() => {
    const started = performance.now();
    let fade: number | undefined;
    const leave = () => setPhase((current) => (current === "showing" ? "leaving" : current));
    const check = () => {
      if (fade !== undefined || !pageReady()) return;
      fade = window.setTimeout(leave, loaderFadeDelay(performance.now() - started, true, reducedMotion) ?? 0);
    };
    const skip = () => {
      window.clearTimeout(fade);
      leave();
    };

    check();
    window.addEventListener("load", check);
    const main = document.getElementById("main");
    const observer = new MutationObserver(check);
    if (main) observer.observe(main, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-busy"] });
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.clearTimeout(fade);
      observer.disconnect();
      window.removeEventListener("load", check);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const gone = window.setTimeout(() => setPhase("done"), reducedMotion ? LOADER_FADE_REDUCED_MS : LOADER_FADE_MS);
    return () => window.clearTimeout(gone);
  }, [phase, reducedMotion]);

  if (phase === "done") return null;

  return (
    // `dark` so tokens are the dark theme's even in light mode; `fixed` + z-index also make it a stacking context,
    // which the X's screen blend needs.
    <div
      aria-hidden
      data-testid="sign-in-loader"
      data-leaving={phase === "leaving" ? "" : undefined}
      className="sign-in-loader dark fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: STAGE_BACKGROUND }}
    >
      <noscript>
        <style>{".sign-in-loader{display:none}"}</style>
      </noscript>
      <div className="stage-glow stage-glow--on" />
      {!reducedMotion && <GlassX eager replayOnClick={false} className="w-[min(78vmin,640px)]" />}
    </div>
  );
}
