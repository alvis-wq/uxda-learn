import path from "node:path";
import { describe, expect, it } from "vitest";
import { heroImageErrors, parseHeroes, validateHeroesFile } from "./heroes";

const ok = `heroes:
  - person: Linda
    hero: Captain America
    image: /heroes/linda.jpg
    description: Leads through trust.
    traits: [A, B, C, D, E]
`;

describe("heroes.yaml", () => {
  it("the real file is valid and every portrait exists", () => {
    const heroes = validateHeroesFile(path.resolve(__dirname, "../.."));
    expect(heroes.length).toBeGreaterThan(2);
    // The top row: the first two are both Captain America.
    expect(heroes.slice(0, 2).map((h) => h.hero)).toEqual(["Captain America", "Captain America"]);
  });

  it("parses a valid file", () => {
    expect(parseHeroes(ok)).toEqual({
      heroes: [{ person: "Linda", hero: "Captain America", image: "/heroes/linda.jpg", description: "Leads through trust.", traits: ["A", "B", "C", "D", "E"] }],
      errors: [],
    });
  });

  it("rejects a missing field, the wrong number of traits, unknown keys and images outside public/heroes/", () => {
    expect(parseHeroes(ok.replace("    hero: Captain America\n", "")).errors).toEqual([expect.stringMatching(/^heroes\.0\.hero: /)]);
    expect(parseHeroes(ok.replace("[A, B, C, D, E]", "[A, B, C, D]")).errors).toEqual([expect.stringMatching(/^heroes\.0\.traits: /)]);
    expect(parseHeroes(ok.replace("description: Leads through trust.", 'description: "  "')).errors).toEqual([expect.stringMatching(/^heroes\.0\.description: /)]);
    expect(parseHeroes(`${ok}    extra: 1\n`).errors).toEqual([expect.stringMatching(/^heroes\.0: /)]);
    expect(parseHeroes(ok.replace("/heroes/linda.jpg", "/challenges/linda.jpg")).errors).toEqual([expect.stringMatching(/public\/heroes\//)]);
    expect(parseHeroes("heroes: []").errors).toHaveLength(1);
    expect(parseHeroes("heroes: [").errors[0]).toMatch(/^not valid YAML/);
  });

  it("reports portraits that aren't on disk", () => {
    const { heroes } = parseHeroes(ok);
    expect(heroImageErrors(heroes, () => true)).toEqual([]);
    expect(heroImageErrors(heroes, () => false)).toEqual(['heroes.0.image: "/heroes/linda.jpg" (Linda) not found in public/heroes/']);
  });
});
