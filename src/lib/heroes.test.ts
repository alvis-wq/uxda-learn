import path from "node:path";
import { describe, expect, it } from "vitest";
import { heroForEmail, heroImageErrors, parseHeroes, validateHeroesFile } from "./heroes";

const ok = `heroes:
  - person: Linda
    hero: Captain America
    image: /heroes/linda.jpg
    email: linda@uxdesignagency.com
    description: Leads through trust.
    traits: [A, B, C, D, E]
`;

describe("heroes.yaml", () => {
  it("the real file is valid and every portrait exists", () => {
    const heroes = validateHeroesFile(path.resolve(__dirname, "../.."));
    expect(heroes.length).toBeGreaterThan(2);
  });

  it("parses a valid file", () => {
    expect(parseHeroes(ok)).toEqual({
      heroes: [{ person: "Linda", hero: "Captain America", image: "/heroes/linda.jpg", email: "linda@uxdesignagency.com", description: "Leads through trust.", traits: ["A", "B", "C", "D", "E"] }],
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

  it("emails: valid, lowercase and unique; avatar box optional and within the portrait", () => {
    expect(parseHeroes(ok.replace("linda@uxdesignagency.com", "Linda@uxdesignagency.com")).errors).toEqual(["heroes.0.email: must be lowercase"]);
    expect(parseHeroes(ok.replace("linda@uxdesignagency.com", "linda")).errors).toEqual([expect.stringMatching(/^heroes\.0\.email: /)]);
    const twice = ok + ok.replace("heroes:\n", "");
    expect(parseHeroes(twice).errors).toEqual(['heroes.1.email: "linda@uxdesignagency.com" is also used by heroes.0']);
    const withAvatar = (a: string) => ok.replace("    description", `    avatar: ${a}\n    description`);
    expect(parseHeroes(withAvatar("{ x: 0.5, y: 0.3, size: 0.2 }")).heroes[0].avatar).toEqual({ x: 0.5, y: 0.3, size: 0.2 });
    expect(parseHeroes(withAvatar("{ x: 1.2, y: 0.3, size: 0.2 }")).errors).toEqual([expect.stringMatching(/^heroes\.0\.avatar\.x: /)]);
    expect(parseHeroes(withAvatar("{ x: 0.5, y: 0.3, size: 0 }")).errors).toEqual([expect.stringMatching(/^heroes\.0\.avatar\.size: /)]);
  });

  it("finds a user's hero by email, ignoring case; none for anyone else", () => {
    const { heroes } = parseHeroes(ok);
    expect(heroForEmail(heroes, "Linda@UXDesignAgency.com")?.person).toBe("Linda");
    expect(heroForEmail(heroes, "someone@uxdesignagency.com")).toBeUndefined();
    expect(heroForEmail(heroes, null)).toBeUndefined();
  });

  it("every person in the real file has their UXDA email", () => {
    const heroes = validateHeroesFile(path.resolve(__dirname, "../.."));
    expect(heroes.every((h) => h.email.endsWith("@uxdesignagency.com"))).toBe(true);
    expect(heroForEmail(heroes, "roberts.ceruss@uxdesignagency.com")?.person).toBe("Roberts C");
    expect(heroForEmail(heroes, "zanna@uxdesignagency.com")?.person).toBe("Žanna");
  });
});
