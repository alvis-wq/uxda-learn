import { getImageProps } from "next/image";
import type { HeroImage } from "@/components/hero-card";
import type { Hero } from "@/lib/heroes";

/** next/image's optimized URLs for a portrait (600×800), for the hero card's own <img>. `sizes` as on next/image. */
export function heroPortrait(hero: Hero, sizes: string): HeroImage {
  const { props } = getImageProps({ src: hero.image, alt: "", width: 600, height: 800, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
