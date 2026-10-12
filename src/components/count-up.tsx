"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Whole numbers as-is, otherwise one decimal. Fixed locale so the server and the browser print the same. */
export function formatPoints(value: number): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

// Module state survives client-side navigations: the count-up plays on the first view of the home page in a
// browser session, then the number is simply there.
let played = false;

/**
 * A number that counts up from 0 the first time it is seen. The server renders the final value (so it is correct
 * without JS and with reduced motion); the animation is applied to the DOM before first paint, so there is no flash
 * of the final number. Screen readers get the final value only, never the intermediate ones.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = el.current;
    if (!node || reduced || played) return;
    node.textContent = formatPoints(0);
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = formatPoints(Math.round(v));
      },
      onComplete: () => {
        node.textContent = formatPoints(value);
        played = true; // only once it has really finished: a StrictMode re-run must start it again
      },
    });
    return () => {
      controls.stop();
      node.textContent = formatPoints(value);
    };
  }, [value, reduced]);

  return (
    <>
      <span ref={el} aria-hidden className={className} data-testid="count-up">
        {formatPoints(value)}
      </span>
      <span className="sr-only">{formatPoints(value)}</span>
    </>
  );
}
