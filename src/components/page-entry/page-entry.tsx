"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { isContentRoot, playEntry } from "./entry";

// Module state survives the template re-mounting on every navigation.
let lastPath: string | undefined;
const played = new WeakSet<Element>();

/**
 * Route entry animation, used as `template.tsx` (so it sits inside the layout: the header and navigation never animate).
 *
 * - Plays when the route (pathname) changes, not on re-renders, search-param changes or server-action refreshes.
 * - Not on the initial page load: that content is already on screen, and hiding it again would flash.
 * - Pages stream in behind loading.tsx skeletons; those (aria-busy) are never animated, the real content is, when it arrives.
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

    const initialLoad = lastPath === undefined;
    const routeChanged = lastPath !== pathname;
    lastPath = pathname;
    if (initialLoad) fresh().forEach((el) => played.add(el));
    else if (routeChanged) {
      // A route change that keeps the same DOM (e.g. /categories/a -> /categories/b) must still animate.
      const roots = Array.from(wrapper.children).filter(isContentRoot);
      play(roots);
    }

    // Content arriving later (the skeleton being replaced by the page) animates when it appears.
    const observer = new MutationObserver(() => play(fresh()));
    observer.observe(wrapper, { childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
