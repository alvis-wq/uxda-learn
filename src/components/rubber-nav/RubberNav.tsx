'use client';

/*
 * Main navigation adapted from React Bits' RubberSegment (https://reactbits.dev/r/RubberSegment-TS-CSS.json).
 *
 * Kept from upstream: the rubber thumb that stretches across the gap and squashes into place, the
 * clip-path reveal that swaps the label colour under the thumb, and the slot measuring.
 * Changed for navigation: it is a <nav> of real Next <Link>s (normal Tab order, aria-current="page"),
 * the active item comes from the pathname (no value/onChange, no radiogroup), and there is no dragging
 * and no arrow-key selection. When no item matches the route the thumb fades out.
 * The thumb's clip-path and opacity are written to the element from the motion values' change events
 * (not via useTransform): a derived style isn't refreshed after a plain jump(), which left the thumb
 * unclipped when the page loaded on any item but the first.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

import './RubberNav.css';

export type RubberNavItem = { href: string; label: string; icon: ReactNode; exact?: boolean };

type Slot = { l: number; r: number };

// size md, radius 24, inset 3, equal slots, stretch 100, squash 3, speed 1
const RADIUS = 24;
const INSET = 3;
const STRETCH = 100;
const SQUASH = 3;
const SPEED = 1;

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const SPRING_UI = { type: 'spring' as const, duration: 0.3, bounce: 0 };
const SPRING_RELAX = { type: 'spring' as const, duration: 0.16, bounce: 0 };
const DILATE = 0.19;
const HANDOFF = 0.15;
const MAX_VELOCITY = 2000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const t = (seconds: number) => seconds / SPEED;

const isActive = (pathname: string, item: RubberNavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

function ItemContent({ item }: { item: RubberNavItem }) {
  // Below md only the icon shows; the link keeps its accessible name through aria-label.
  return (
    <>
      {item.icon}
      <span className="hidden md:inline">{item.label}</span>
    </>
  );
}

export function RubberNav({ items, 'aria-label': ariaLabel = 'Main' }: { items: RubberNavItem[]; 'aria-label'?: string }) {
  const pathname = usePathname();
  const index = items.findIndex(item => isActive(pathname, item));
  const reduce = useReducedMotion();

  const trackRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const slots = useRef<Slot[]>([]);
  const committed = useRef(index);
  const handoff = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gen = useRef(0);
  const latest = useRef({ index, count: items.length, reduce });

  const edgeL = useMotionValue(0);
  const edgeR = useMotionValue(0);
  const innerW = useMotionValue(0);
  const thumbOpacity = useMotionValue(index >= 0 ? 1 : 0);
  const thumbRadius = Math.max(0, RADIUS - INSET);

  const listKey = items.map(item => item.href).join('|');
  useEffect(() => {
    latest.current = { index, count: items.length, reduce };
  });

  // Keep the thumb element in step with the motion values (clip-path = the stretch/squash, opacity = shown/hidden).
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const paint = () => {
      thumb.style.clipPath = `inset(0 ${Math.max(0, innerW.get() - edgeR.get())}px 0 ${Math.max(0, edgeL.get())}px round ${thumbRadius}px)`;
      thumb.style.opacity = String(thumbOpacity.get());
    };
    paint();
    const stops = [edgeL, edgeR, innerW, thumbOpacity].map(value => value.on('change', paint));
    return () => stops.forEach(stop => stop());
  }, [edgeL, edgeR, innerW, thumbOpacity, thumbRadius]);

  useLayoutEffect(() => {
    const jumpTo = (i: number) => {
      const s = slots.current[i];
      if (!s) return;
      clearTimeout(handoff.current);
      gen.current += 1;
      edgeL.jump(s.l);
      edgeR.jump(s.r);
    };

    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      slots.current = Array.from({ length: latest.current.count }, (_, i) => {
        const el = itemRefs.current[i];
        if (!el) return { l: 0, r: 0 };
        const r = el.getBoundingClientRect();
        return { l: r.left - rect.left - INSET, r: r.right - rect.left - INSET };
      });
      innerW.set(rect.width - INSET * 2);
      jumpTo(committed.current);
      thumbOpacity.jump(committed.current >= 0 ? 1 : 0);
      track.dataset.ready = '';
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [listKey, edgeL, edgeR, innerW, thumbOpacity]);

  // Route changed: stretch and squash to the new item (or fade the thumb in/out when no item matches).
  useEffect(() => {
    const from = committed.current;
    if (from === index) return;
    committed.current = index;

    const fade = (to: number) => {
      if (latest.current.reduce) thumbOpacity.jump(to);
      else animate(thumbOpacity, to, { duration: t(0.2), ease: EASE_OUT });
    };
    const land = (to: number) => {
      const b = slots.current[to];
      if (!b) return;
      const g = ++gen.current;
      const dir = Math.sign((b.l + b.r) / 2 - (edgeL.get() + edgeR.get()) / 2) || 1;
      const [lead, leadTo, trail, trailTo] = dir > 0 ? [edgeR, b.r, edgeL, b.l] : [edgeL, b.l, edgeR, b.r];
      animate(lead, leadTo, { ...SPRING_UI, duration: t(0.3), velocity: clamp(lead.getVelocity(), -MAX_VELOCITY, MAX_VELOCITY) });
      const trailVelocity = clamp(trail.getVelocity(), -MAX_VELOCITY, MAX_VELOCITY);
      animate(trail, trailTo + dir * SQUASH, { ...SPRING_UI, duration: t(0.3), velocity: trailVelocity }).then(() => {
        if (gen.current === g) animate(trail, trailTo, { ...SPRING_RELAX, duration: t(0.16) });
      });
    };

    if (index < 0) {
      fade(0);
      return;
    }
    const b = slots.current[index];
    if (!b) return;
    clearTimeout(handoff.current);
    gen.current += 1;
    if (from < 0 || latest.current.reduce) {
      // Nothing to travel from (or reduced motion): the thumb jumps into place.
      edgeL.jump(b.l);
      edgeR.jump(b.r);
      if (from < 0) fade(1);
      return;
    }
    const a = slots.current[from];
    if (!a) return;
    const u = STRETCH / 100;
    const tween = { duration: t(DILATE), ease: EASE_OUT };
    animate(edgeL, b.l + (Math.min(a.l, b.l) - b.l) * u, tween);
    animate(edgeR, b.r + (Math.max(a.r, b.r) - b.r) * u, tween);
    handoff.current = setTimeout(() => land(index), t(HANDOFF) * 1000);
  }, [index, edgeL, edgeR, thumbOpacity]);

  useEffect(
    () => () => {
      clearTimeout(handoff.current);
      edgeL.stop();
      edgeR.stop();
    },
    [edgeL, edgeR]
  );

  return (
    <nav
      ref={trackRef}
      aria-label={ariaLabel}
      className="rubber-nav"
      style={
        {
          '--rn-radius': `${RADIUS}px`,
          '--rn-inset': `${INSET}px`,
          '--rn-thumb-radius': `${thumbRadius}px`
        } as CSSProperties
      }
    >
      {items.map((item, i) => (
        <Link
          key={item.href}
          ref={el => {
            itemRefs.current[i] = el;
          }}
          href={item.href}
          draggable={false}
          aria-label={item.label}
          aria-current={i === index ? 'page' : undefined}
          className="rubber-nav__item"
        >
          <ItemContent item={item} />
        </Link>
      ))}
      <div ref={thumbRef} className="rubber-nav__thumb" aria-hidden="true">
        {items.map(item => (
          <span key={item.href} className="rubber-nav__item rubber-nav__copy">
            <ItemContent item={item} />
          </span>
        ))}
      </div>
    </nav>
  );
}
