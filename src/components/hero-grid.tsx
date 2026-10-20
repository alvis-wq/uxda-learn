import { HeroCard } from "@/components/hero-card";
import { heroPortrait } from "@/components/hero-portrait";
import type { Hero } from "@/lib/heroes";

const SIZES = "(min-width: 1024px) 240px, (min-width: 768px) 30vw, 50vw";

/** The UXDA Superhero Team, one even grid in heroes.yaml order: 4 per row (desktop), 3 (tablet), 2 (mobile). */
export function HeroGrid({ heroes }: { heroes: Hero[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4" data-testid="hero-grid">
      {heroes.map((hero, i) => (
        <li key={hero.image}>
          <HeroCard hero={hero} image={heroPortrait(hero, SIZES)} index={i} />
        </li>
      ))}
    </ul>
  );
}
