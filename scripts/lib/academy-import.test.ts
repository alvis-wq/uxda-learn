import { describe, expect, it } from "vitest";
import { bookDone, matchPerson, parseAcademySheet, parseBlogSheet, parseOtherBooksSheet, resourceKey, splitTitleAuthor, titlesMatch } from "./academy-import";

// Shapes as in the real spreadsheet (header on row 2, a title row above it).
const blogGrid = [
  ["UXDA Blog", null, null, null, "  Link", "  Team reading status", null, null, "AI Podcasts statuses"],
  ["Nr.", "Category", null, "Title", "Link", "Inese", "Roberts C.", "Žanna", "Episode number", "Published?"],
  [1, "Strategy", null, "Banking on Purpose", "https://www.theuxda.com/blog/a", true, false, 1, null, null],
  [2, " UX Trends", null, "🎧 UXDA Methodology", "https://theuxda.com/blog/b", 0, 1, 0, 88, "yes"],
  [null, null, null, null, null],
];

describe("parseBlogSheet", () => {
  it("reads posts with their people columns (between Link and Episode number)", () => {
    expect(parseBlogSheet(blogGrid)).toEqual([
      {
        kind: "blog",
        number: 1,
        title: "Banking on Purpose",
        author: null,
        url: "https://www.theuxda.com/blog/a",
        category: "Strategy",
        people: [
          { name: "Inese", done: true },
          { name: "Roberts C.", done: false },
          { name: "Žanna", done: true },
        ],
        episode: null,
      },
      expect.objectContaining({ number: 2, episode: "88", title: "UXDA Methodology", category: "UX Trends", people: expect.arrayContaining([{ name: "Roberts C.", done: true }]) }),
    ]);
  });
});

describe("book sheets", () => {
  it("splits title and author, reads ✅ as read, and numbers the 💯 playbooks first", () => {
    const grid = [
      ["UXDA Academy", null, "  Team reading status"],
      ["Nr.", "Book name / author", "Inese", "Arita"],
      ["💯", "UXDA Sales Playbook", "In process 💆🏼", "Read  ✅"],
      [1, "DON'T MAKE ME THINK  / Steve Krug", "Read  ✅", "Not read ⚠️"],
    ];
    expect(parseAcademySheet(grid)).toEqual([
      { kind: "book", number: 0, title: "UXDA Sales Playbook", author: null, url: null, category: "academy", people: [{ name: "Inese", done: false }, { name: "Arita", done: true }] },
      { kind: "book", number: 1, title: "DON'T MAKE ME THINK", author: "Steve Krug", url: null, category: "academy", people: [{ name: "Inese", done: true }, { name: "Arita", done: false }] },
    ]);
  });

  it("keeps the link of other insightful books", () => {
    const grid = [
      ["Nr.", "Category", "Book name / author", "Link", "Inese"],
      [4, "Design", "Start with Why", "https://www.amazon.com/dp/1591846447", "Read  ✅"],
      [5, "Design", "Internal PDF", "see drive", null],
    ];
    expect(parseOtherBooksSheet(grid).map((b) => [b.title, b.url, b.category, b.people[0].done])).toEqual([
      ["Start with Why", "https://www.amazon.com/dp/1591846447", "other", true],
      ["Internal PDF", null, "other", false],
    ]);
  });

  it("only counts read", () => {
    expect(["Read  ✅", "Read  ✅ \n(a while ago)"].every(bookDone)).toBe(true);
    expect(["In process 💆🏼", "Not read ⚠️", "? (will check)", "", null].some(bookDone)).toBe(false);
    expect(splitTitleAuthor("A / B / C")).toEqual({ title: "A / B", author: "C" });
  });
});

describe("matchPerson", () => {
  const profiles = [
    { id: "1", email: "inese@x.com", full_name: "Inese Ozola" },
    { id: "2", email: "rc@x.com", full_name: "Roberts Cirulis" },
    { id: "3", email: "rr@x.com", full_name: "Roberts Rozitis" },
    { id: "4", email: "zanna@x.com", full_name: "Zanna Berzina" },
  ];
  it("matches by first name (and last-name initial), ignoring accents", () => {
    expect(matchPerson("Inese", profiles, {})).toEqual({ profile: profiles[0] });
    expect(matchPerson("Roberts C.", profiles, {})).toEqual({ profile: profiles[1] });
    expect(matchPerson("Žanna", profiles, {})).toEqual({ profile: profiles[3] });
  });
  it("reports ambiguity and absence, and lets the mapping file decide", () => {
    expect(matchPerson("Roberts", profiles, {})).toMatchObject({ error: expect.stringMatching(/2 profiles/) });
    expect(matchPerson("Agnese", profiles, {})).toMatchObject({ error: expect.stringMatching(/no profile/) });
    expect(matchPerson("Roberts", profiles, { Roberts: "RR@x.com" })).toEqual({ profile: profiles[2] });
    expect(matchPerson("Agnese", profiles, { Agnese: "agnese@x.com" })).toMatchObject({ error: expect.stringMatching(/hasn't signed in/) });
  });
});

describe("titlesMatch / resourceKey", () => {
  it("accepts the same book with different case or a subtitle, rejects another book", () => {
    expect(titlesMatch("DON'T MAKE ME THINK", "Don't make me think, revisited")).toBe(true);
    expect(titlesMatch("UXDA Sales Playbook", "The Sales Playbook")).toBe(false);
    expect(titlesMatch("", "Anything")).toBe(false);
  });
  it("treats www and trailing slashes as the same post", () => {
    expect(resourceKey({ kind: "blog", url: "https://www.theuxda.com/blog/a/", title: "x" })).toBe(resourceKey({ kind: "blog", url: "https://theuxda.com/blog/a", title: "y" }));
    expect(resourceKey({ kind: "book", url: null, title: "DON'T MAKE ME THINK" })).toBe("book:don t make me think");
  });
});
