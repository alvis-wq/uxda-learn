"use client";

import { useId, type CSSProperties } from "react";
import TiltedCard, { TiltedCardLayer, type TiltedCardProps } from "@/components/tilted-card/TiltedCard";
import type { Hero } from "@/lib/heroes";

export type HeroImage = { src: string } & NonNullable<TiltedCardProps["imageProps"]>;

/**
 * One member of the UXDA Superhero Team, on a React Bits TiltedCard: hover tilts; click, tap, Enter or Space flips it
 * (reduced motion: no tilt or intro, the flip is a crossfade). Front: portrait, name, hero name. Back: hero name,
 * description, traits.
 *
 * The card is a toggle button named after the person, and the text inside a button isn't read out on its own, so both
 * sides' text is repeated once in a screen-reader-only block next to it.
 */
export function HeroCard({
  hero,
  image,
  index,
  nameAs: Name = "h3",
}: {
  hero: Hero;
  image: HeroImage;
  index: number;
  /** The person's name in the screen-reader block: a heading in the /heroes list, plain text where the page already names them. */
  nameAs?: "h3" | "p";
}) {
  const nameId = useId();
  const { src, ...imageProps } = image;

  return (
    <article aria-labelledby={nameId}>
      <div className="sr-only">
        <Name id={nameId}>{hero.person}</Name>
        <p>{hero.hero}</p>
        <p>{hero.description}</p>
        <ul aria-label={`${hero.person}'s traits`}>
          {hero.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <TiltedCard
        imageSrc={src}
        imageProps={{ ...imageProps, loading: "lazy", decoding: "async" }}
        altText={`Portrait of ${hero.person}`}
        ariaLabel={`${hero.person}, ${hero.hero}`}
        aspectRatio="3 / 4"
        containerWidth="100%"
        rotateAmplitude={12}
        scaleOnHover={1.05}
        glare={0.5}
        shadow={0.5}
        showTooltip={false}
        gyroscope={false}
        intro
        introDelay={Math.min(index * 40, 600)}
        radius={15}
        hoverStroke="linear-gradient(135deg, #b5a2ff, #7438fb)"
        style={{ borderRadius: 15, "--tc-focus-color": "var(--brand-text)" } as CSSProperties}
        backContent={
          <div className="bg-card text-card-foreground flex h-full flex-col gap-1.5 p-3 sm:gap-3 sm:p-4">
            <p className="text-meta text-brand-text leading-snug font-semibold sm:text-sm">{hero.hero}</p>
            <p className="text-muted-foreground sm:text-meta text-[0.6875rem] leading-snug">{hero.description}</p>
            <ul className="mt-auto flex flex-wrap gap-1">
              {hero.traits.map((t) => (
                <li
                  key={t}
                  className="bg-accent text-accent-foreground rounded-full px-1.5 py-px text-[0.625rem] leading-4 font-medium sm:px-2 sm:py-0.5 sm:text-xs"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        <TiltedCardLayer depth={30}>
          <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] leading-4 font-medium text-white">
            <span className="pointer-fine:hidden">Tap to flip</span>
            <span className="hidden pointer-fine:inline">Click to flip</span>
          </span>
          <div className="absolute -inset-x-4 -bottom-4 h-1/2 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-4 sm:pb-4">
            <p className="text-sm leading-tight font-semibold text-white sm:text-base">{hero.person}</p>
            <p className="text-meta mt-0.5 leading-snug text-white/90">{hero.hero}</p>
          </div>
        </TiltedCardLayer>
      </TiltedCard>
    </article>
  );
}
