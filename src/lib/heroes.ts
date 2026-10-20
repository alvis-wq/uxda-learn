import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

/**
 * The UXDA Superhero Team on the Heroes page: content/heroes.yaml (display order = file order), portraits in
 * public/heroes/ (600×800). Validated at build time by next.config.ts, so a missing field or image fails the build;
 * the page reads the same file at request time (traced into the server bundle via outputFileTracingIncludes).
 * Kept free of `server-only`: next.config.ts imports it.
 */
export const HEROES_FILE = "content/heroes.yaml";

export const HERO_IMAGE_SRC = /^\/heroes\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;

const text = z.string().trim().min(1);

export const heroSchema = z.strictObject({
  person: text,
  hero: text,
  image: z.string().regex(HERO_IMAGE_SRC, "use a file in public/heroes/, written as /heroes/<file>.jpg (or .png, .webp, .avif; lowercase)"),
  description: text,
  traits: z
    .array(text)
    .length(5)
    .refine((t) => new Set(t).size === t.length, "traits must all be different"),
});

export const heroesFileSchema = z.strictObject({ heroes: z.array(heroSchema).min(1) });

export type Hero = z.infer<typeof heroSchema>;

/** Parse heroes.yaml text; problems come back as readable messages instead of a throw. */
export function parseHeroes(source: string): { heroes: Hero[]; errors: string[] } {
  let raw: unknown;
  try {
    raw = YAML.parse(source);
  } catch (e) {
    return { heroes: [], errors: [`not valid YAML: ${(e as Error).message}`] };
  }
  const parsed = heroesFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { heroes: [], errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { heroes: parsed.data.heroes, errors: [] };
}

/** Portraits that aren't in public/heroes/. */
export function heroImageErrors(heroes: Hero[], exists: (src: string) => boolean): string[] {
  return heroes.flatMap((h, i) => (exists(h.image) ? [] : [`heroes.${i}.image: "${h.image}" (${h.person}) not found in public/heroes/`]));
}

/** Full check (fields + images on disk), for the build. Throws with every problem listed. */
export function validateHeroesFile(root = process.cwd()): Hero[] {
  const { heroes, errors } = parseHeroes(readFileSync(path.join(root, HEROES_FILE), "utf8"));
  errors.push(...heroImageErrors(heroes, (src) => existsSync(path.join(root, "public", src))));
  if (errors.length > 0) throw new Error(`${HEROES_FILE} is invalid:\n  ${errors.join("\n  ")}`);
  return heroes;
}

let cached: Hero[] | undefined;

/** The heroes, for the page. The file was validated at build time; a parse error here still throws. */
export function loadHeroes(): Hero[] {
  if (!cached) {
    const { heroes, errors } = parseHeroes(readFileSync(path.join(process.cwd(), HEROES_FILE), "utf8"));
    if (errors.length > 0) throw new Error(`${HEROES_FILE} is invalid:\n  ${errors.join("\n  ")}`);
    cached = heroes;
  }
  return cached;
}
