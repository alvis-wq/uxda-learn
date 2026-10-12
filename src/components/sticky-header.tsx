"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The sticky site header. Transparent while the page is at the top; once content scrolls under it, it gets a
 * translucent background, backdrop blur and a hairline bottom border (see `.site-header` in globals.css).
 * The server always renders the "top" state, so there is nothing to mismatch on hydration. A 1px sentinel at the
 * top of the page tells us when it has scrolled away, so there is no scroll listener.
 */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
      <header data-scrolled={scrolled ? "" : undefined} className="site-header sticky top-0 z-40">
        {children}
      </header>
    </>
  );
}
