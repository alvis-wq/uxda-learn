/**
 * Helpers for rendering a challenge's brief (the markdown body). The content files are never edited: the page title
 * already says what the challenge is, so a brief that opens by repeating it as a heading is shown without that line,
 * and once a learner has started, only the brief's first paragraph is shown until they ask for the rest.
 */

/** Compare headings and titles loosely: case, punctuation, markdown emphasis and spacing don't matter. */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;

/** The brief without a leading heading that matches the challenge title. Anything else is returned untouched. */
export function stripLeadingTitle(body: string, title: string): string {
  const lines = body.split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first === -1) return body;
  const heading = HEADING.exec(lines[first]);
  if (!heading || normalize(heading[1]) !== normalize(title)) return body;
  const rest = lines.slice(first + 1);
  while (rest.length > 0 && rest[0].trim() === "") rest.shift();
  return rest.join("\n");
}

type Block = { text: string; heading: boolean };

/** Split markdown into blocks at blank lines, keeping a fenced code block (which may contain blank lines) whole. */
function blocks(body: string): Block[] {
  const out: Block[] = [];
  let current: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    if (current.length > 0) {
      out.push({ text: current.join("\n"), heading: current.length === 1 && HEADING.test(current[0]) });
      current = [];
    }
  };
  for (const line of body.split("\n")) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) fence = marker[0];
    else if (fence !== null && marker && marker[0] === fence) fence = null;
    if (fence === null && line.trim() === "") flush();
    else current.push(line);
  }
  flush();
  return out;
}

export type BriefView = {
  /** The brief to show in full, without a leading heading that repeats the title. */
  body: string;
  /** Its first paragraph: the first block that isn't a heading. */
  first: string;
  /** There is more than that first paragraph, so collapsing it hides something. */
  hasMore: boolean;
};

export function briefView(body: string, title: string): BriefView {
  const stripped = stripLeadingTitle(body, title);
  const all = blocks(stripped);
  const at = all.findIndex((b) => !b.heading);
  if (at === -1) return { body: stripped, first: stripped, hasMore: false };
  // Headings before the first paragraph aren't kept: the collapsed brief is the paragraph alone.
  const hasMore = all.slice(at + 1).length > 0;
  return { body: stripped, first: all[at].text, hasMore };
}
