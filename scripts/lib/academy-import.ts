/**
 * Reading the old "UXDA Blog and Academy reading status" spreadsheet: the blog list (UXDA BLOG), the Academy books
 * (UXDA ACADEMY) and the other insightful books (OTHER INSIGHTFUL BOOKS), each with one column per person saying who
 * has read what. Pure functions over plain cell grids (scripts/import-academy.ts reads the .xlsx), so they're tested
 * without the file.
 */

export type Cell = string | number | boolean | null;
export type Grid = Cell[][];

export type SheetPerson = { name: string; done: boolean };
export type SheetResource = {
  kind: "blog" | "book";
  number: number | null;
  title: string;
  author: string | null;
  url: string | null;
  /** Blog: its category in the sheet. Book: 'academy' or 'other'. */
  category: string | null;
  people: SheetPerson[];
};

export const BLOG_SHEET = "UXDA BLOG";
export const ACADEMY_SHEET = "UXDA ACADEMY";
export const OTHER_BOOKS_SHEET = "OTHER INSIGHTFUL BOOKS";

const text = (c: Cell | undefined) => (c === null || c === undefined ? "" : String(c)).trim();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The header row (the one whose first cell is "Nr.") and its column positions by header text. */
function header(grid: Grid): { row: number; col: (name: string) => number; cells: string[] } {
  const row = grid.findIndex((r) => norm(text(r[0])) === "nr.");
  if (row < 0) throw new Error('no header row (a row starting with "Nr.")');
  const cells = grid[row].map(text);
  return { row, cells, col: (name) => cells.findIndex((c) => norm(c) === norm(name)) };
}

/** Person columns: every non-empty header between `from` (exclusive) and `to` (exclusive, or the end). */
function personColumns(cells: string[], from: number, to: number): { col: number; name: string }[] {
  const end = to < 0 ? cells.length : to;
  const out: { col: number; name: string }[] = [];
  for (let c = from + 1; c < end; c++) if (cells[c]) out.push({ col: c, name: cells[c] });
  return out;
}

const asNumber = (c: Cell | undefined) => {
  const n = typeof c === "number" ? c : Number(text(c));
  return Number.isFinite(n) && text(c) !== "" ? Math.round(n) : null;
};

/**
 * A blog cell: a ticked checkbox (TRUE; 1 in older exports) = read. A book cell: "Read ✅" = read ("In process",
 * "Not read ⚠️", "?" are not).
 */
export const blogDone = (c: Cell | undefined) => c === true || ["1", "true"].includes(text(c).toLowerCase());
export const bookDone = (c: Cell | undefined) => /^read\b/i.test(text(c)) || text(c).includes("✅");

export function parseBlogSheet(grid: Grid): SheetResource[] {
  const h = header(grid);
  const title = h.col("Title");
  const link = h.col("Link");
  const category = h.col("Category");
  const episode = h.col("Episode number");
  if (title < 0 || link < 0) throw new Error(`${BLOG_SHEET}: needs Title and Link columns`);
  const people = personColumns(h.cells, link, episode);
  return grid
    .slice(h.row + 1)
    .filter((r) => /^https?:\/\//.test(text(r[link])))
    .map((r) => ({
      kind: "blog" as const,
      number: asNumber(r[0]),
      title: text(r[title]).replace(/^🎧\s*/u, ""),
      author: null,
      url: text(r[link]),
      category: text(r[category]) || null,
      people: people.map((p) => ({ name: p.name, done: blogDone(r[p.col]) })),
    }));
}

/** "DON'T MAKE ME THINK / Steve Krug" → title and author (the sheet has both in one cell). */
export function splitTitleAuthor(cell: string): { title: string; author: string | null } {
  const i = cell.lastIndexOf(" / ");
  if (i < 0) return { title: cell.trim(), author: null };
  return { title: cell.slice(0, i).trim(), author: cell.slice(i + 3).trim() || null };
}

export function parseAcademySheet(grid: Grid): SheetResource[] {
  const h = header(grid);
  const name = h.col("Book name / author");
  if (name < 0) throw new Error(`${ACADEMY_SHEET}: needs a "Book name / author" column`);
  const people = personColumns(h.cells, name, -1);
  return grid
    .slice(h.row + 1)
    .filter((r) => text(r[name]))
    .map((r) => {
      const { title, author } = splitTitleAuthor(text(r[name]));
      return {
        kind: "book" as const,
        // The two UXDA playbooks are numbered 💯: they go first.
        number: asNumber(r[0]) ?? 0,
        title,
        author,
        url: null,
        category: "academy",
        people: people.map((p) => ({ name: p.name, done: bookDone(r[p.col]) })),
      };
    });
}

export function parseOtherBooksSheet(grid: Grid): SheetResource[] {
  const h = header(grid);
  const name = h.col("Book name / author");
  const link = h.col("Link");
  if (name < 0 || link < 0) throw new Error(`${OTHER_BOOKS_SHEET}: needs "Book name / author" and Link columns`);
  const people = personColumns(h.cells, link, -1);
  return grid
    .slice(h.row + 1)
    .filter((r) => text(r[name]))
    .map((r) => {
      const { title, author } = splitTitleAuthor(text(r[name]));
      const url = text(r[link]);
      return {
        kind: "book" as const,
        number: asNumber(r[0]),
        title,
        author,
        url: /^https?:\/\//.test(url) ? url : null,
        category: "other",
        people: people.map((p) => ({ name: p.name, done: bookDone(r[p.col]) })),
      };
    });
}

// People ---------------------------------------------------------------------------------------------------------

export type Profile = { id: string; email: string; full_name: string | null };

const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

/**
 * Who a spreadsheet column is. An entry in the mapping file (name → email) wins. Otherwise "Inese" matches the one
 * profile whose first name is Inese, and "Roberts C." the one whose first name is Roberts and last name starts with C
 * (accents ignored). No match, or more than one, is reported, never guessed.
 */
export function matchPerson(name: string, profiles: Profile[], mapping: Record<string, string>): { profile: Profile } | { error: string } {
  const mapped = mapping[name];
  if (mapped) {
    const p = profiles.find((x) => x.email.toLowerCase() === mapped.toLowerCase());
    return p ? { profile: p } : { error: `mapped to ${mapped}, who hasn't signed in yet` };
  }
  const [first, initial] = words(name);
  const candidates = profiles.filter((p) => {
    const w = words(p.full_name ?? "");
    if (w[0] !== first) return false;
    return !initial || w.slice(1).some((x) => x.startsWith(initial));
  });
  if (candidates.length === 1) return { profile: candidates[0] };
  if (candidates.length === 0) return { error: "no profile with that name (not signed in yet, or add them to the mapping file)" };
  return { error: `${candidates.length} profiles match (${candidates.map((c) => c.email).join(", ")}): add the right one to the mapping file` };
}

// Books from Open Library -----------------------------------------------------------------------------------------

/** Whether an Open Library title is the book we asked for: the first (up to) three words of the shorter title agree. */
export function titlesMatch(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  if (x.length === 0) return false;
  return x.slice(0, 3).every((w, i) => y[i] === w);
}

/** Identity of a resource across runs: the link for posts, title for books. */
export function resourceKey(r: { kind: string; url: string | null; title: string }): string {
  return r.kind === "blog" && r.url ? `url:${r.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}` : `book:${words(r.title).join(" ")}`;
}
