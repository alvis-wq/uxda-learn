import Image from "next/image";
import { DEFAULT_AVATAR, type Hero } from "@/lib/heroes";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A round avatar cropped to the face in a hero's portrait (heroes.yaml `avatar`: face centre and crop width as
 * fractions of the 600×800 portrait). The portrait is scaled so the crop fills the circle and shifted so the face is
 * centred; the centre is clamped so the crop never runs off the portrait. Decorative: the name sits next to it.
 */
export function HeroAvatar({ hero, size }: { hero: Hero; size: number }) {
  const a = hero.avatar ?? DEFAULT_AVATAR;
  const width = 100 / a.size; // the portrait's width, in % of the circle's
  const x = clamp(a.x, a.size / 2, 1 - a.size / 2);
  const cropHeight = (a.size * 600) / 800; // the crop's height as a fraction of the portrait's height
  const y = clamp(a.y, cropHeight / 2, 1 - cropHeight / 2);

  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full bg-neutral-900"
      style={{ width: size, height: size }}
      data-testid="hero-avatar"
    >
      <Image
        src={hero.image}
        alt=""
        width={600}
        height={800}
        sizes={`${Math.ceil((size * width) / 100)}px`}
        style={{
          position: "absolute",
          maxWidth: "none",
          width: `${width}%`,
          height: "auto",
          left: `${50 - x * width}%`,
          top: `${50 - y * width * (800 / 600)}%`,
        }}
      />
    </span>
  );
}
