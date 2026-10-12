"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { isContentRoot, nextEntryState, playEntry, type EntryState } from "./entry";

// Module state survives the template re-mounting on every navigation.
let entryState: EntryState = { lastPath: undefined, clientNavigated: false };
const played = new WeakSet<Element>();

/**
 * Route entry animation, used as `template.tsx` (so it sits inside the layout: the header and navigation never animate).
 *
 * - The server always renders the final, fully visible state (this component adds no styles to the SSR HTML, so content
 *   is visible without JS). Hidden/animated styles exist only in the DOM, set after a client-side route change.
 * - Plays when the route (pathname) changes, not on re-renders, search-param changes or server-action refreshes.
 * - Never on a hard load, including content that streams in later behind loading.tsx: that is still the initial render
 *   being hydrated, and changing its DOM now causes a hydration mismatch.
 * - After a client navigation, loading.tsx skeletons (aria-busy) are never animated; the real content is, when it arrives.
 * - No exit animation, no layout shift, no pointer-events changes: content is interactive from the first frame.
 */
export default function PageEntry({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduced = !!useReducedMotion();
  const reducedRef = useRef(reduced);

  useLayoutEffect(() => {
    reducedRef.current = reduced;
  });

  useLayoutEffect(() => {
    const wrapper = ref.current;
    if (!wrapper) return;
    const fresh = () => Array.from(wrapper.children).filter((el) => isContentRoot(el) && !played.has(el));
    const play = (roots: Element[]) => {
      roots.forEach((el) => played.add(el));
      if (roots.length) playEntry(roots, reducedRef.current);
    };

    const { state, play: shouldPlay } = nextEntryState(entryState, pathname);
    entryState = state;
    if (shouldPlay) {
      // A route change that keeps the same DOM (e.g. /categories/a -> /categories/b) must still animate.
      play(Array.from(wrapper.children).filter(isContentRoot));
    } else {
      fresh().forEach((el) => played.add(el)); // already on screen: never animate it later
    }

    // Content arriving later (the skeleton being replaced by the page) animates when it appears, but only
    // once a client-side navigation has happened; before that it belongs to the hydrating initial render.
    const observer = new MutationObserver(() => {
      const roots = fresh();
      if (entryState.clientNavigated) play(roots);
      else roots.forEach((el) => played.add(el));
    });
    observer.observe(wrapper, { childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
