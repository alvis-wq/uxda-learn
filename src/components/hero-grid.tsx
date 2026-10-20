import { HeroCard } from "@/components/hero-card";
import type { Hero } from "@/lib/heroes";
import { cn } from "@/lib/utils";

/**
 * The UXDA Superhero Team, one list in file order. The first two cards sit alone in a centred top row; after that,
 * 4 per row (desktop), 3 (tablet, a 6-column grid with cards spanning 2) or 2 (mobile). The top row is made by
 * starting card 1 one card in, and card 3 back at column 1 (which forces a new row).
 */
export function HeroGrid({ heroes }: { heroes: Hero[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-6 md:gap-6 lg:grid-cols-4" data-testid="hero-grid">
      {heroes.map((hero, i) => (
        <li
          key={hero.image}
          className={cn("md:col-span-2 lg:col-span-1", i === 0 && "md:col-start-2 lg:col-start-2", i === 2 && "md:col-start-1 lg:col-start-1")}
        >
          <HeroCard hero={hero} sizes="(min-width: 1024px) 240px, (min-width: 768px) 30vw, 50vw" />
        </li>
      ))}
    </ul>
  );
}
