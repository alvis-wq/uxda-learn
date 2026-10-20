"use client";

import { useId, useState } from "react";
import Image from "next/image";
import type { Hero } from "@/lib/heroes";

/**
 * One member of the UXDA Superhero Team. Front: portrait, name, hero name. Back: hero name, description, traits.
 * Flips in 3D on hover (pointers that can hover), on keyboard focus and on tap (touch/pen toggle, blur flips back);
 * reduced motion crossfades instead (see .hero-card in globals.css). Both faces stay in the accessibility tree:
 * the hidden one is only hidden with backface-visibility / opacity.
 */
export function HeroCard({ hero, sizes }: { hero: Hero; sizes: string }) {
  const [flipped, setFlipped] = useState(false);
  const nameId = useId();

  return (
    <article
      tabIndex={0}
      aria-labelledby={nameId}
      data-flipped={flipped || undefined}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") setFlipped((f) => !f);
      }}
      onBlur={() => setFlipped(false)}
      className="hero-card h-full focus-visible:ring-ring focus-visible:ring-offset-background rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
    >
      <div className="hero-card-inner">
        <div className="hero-card-face relative aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900">
          <Image src={hero.image} alt={`Portrait of ${hero.person}`} fill sizes={sizes} className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pt-12 pb-3 sm:px-4 sm:pb-4">
            <h3 id={nameId} className="text-sm leading-tight font-semibold text-white sm:text-base">
              {hero.person}
            </h3>
            <p className="text-meta mt-0.5 leading-snug text-white/90">{hero.hero}</p>
          </div>
        </div>

        <div className="hero-card-face hero-card-back bg-card text-card-foreground flex flex-col gap-2 rounded-xl border p-3 sm:gap-3 sm:p-4">
          <p className="text-meta text-brand-text leading-snug font-semibold sm:text-sm">{hero.hero}</p>
          <p className="text-muted-foreground text-xs leading-snug sm:text-meta">{hero.description}</p>
          <ul aria-label={`${hero.person}'s traits`} className="mt-auto flex flex-wrap gap-1">
            {hero.traits.map((t) => (
              <li key={t} className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-[0.6875rem] leading-4 font-medium sm:text-xs">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
