/**
 * Images in briefs: markdown `![alt text](/challenges/file.png)`, served from public/challenges/ (the same folder as
 * card artwork). Only those are shown — anything else (another site, another folder) is not rendered — and
 * content:validate requires alt text and an existing file. Kept free of Node imports: the Markdown component uses it.
 *
 * Side images: the title "side" (`![alt](/challenges/file.png "side")`, a paragraph of its own after a block) puts the
 * image to the right of that block, smaller; on a narrow screen it goes below it at full width. No other title is used.
 */
export const BRIEF_IMAGE_SRC = /^\/challenges\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;

export function isBriefImageSrc(src: string | null | undefined): src is string {
  return typeof src === "string" && BRIEF_IMAGE_SRC.test(src);
}

/** The one image title that means something: shown next to the block before it. */
export const SIDE_IMAGE_TITLE = "side";

export type MarkdownImage = { alt: string; src: string; title: string | null; /** Where it starts in the text. */ index: number; raw: string };

/** Every `![alt](src "optional title")` in a markdown text. */
export function markdownImages(markdown: string): MarkdownImage[] {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+["']([^"']*)["'])?\s*\)/g)].map((m) => ({
    alt: m[1].trim(),
    src: m[2],
    title: m[3] ?? null,
    index: m.index,
    raw: m[0],
  }));
}

/**
 * Why a side image can't be laid out next to text: it must be a paragraph of its own (an empty line before and after,
 * or markdown joins it to the text around it), after some text.
 */
function sideImageError(markdown: string, image: MarkdownImage): string | null {
  const lines = markdown.split("\n");
  const at = markdown.slice(0, image.index).split("\n").length - 1;
  const blank = (i: number) => i < 0 || i >= lines.length || !lines[i].trim();
  if (lines[at].trim() !== image.raw || !blank(at - 1) || !blank(at + 1)) {
    return `image "${image.src}": a "side" image goes on a line of its own, with an empty line before and after it`;
  }
  if (!lines.slice(0, at).some((l) => l.trim())) return `image "${image.src}": a "side" image needs text before it to sit next to`;
  return null;
}

/** Problems with a brief's images (no alt text, not in public/challenges/, missing file), as validation messages. */
export function briefImageErrors(markdown: string, exists: (file: string) => boolean): string[] {
  const errors: string[] = [];
  for (const image of markdownImages(markdown)) {
    const { alt, src, title } = image;
    if (title !== null && title !== SIDE_IMAGE_TITLE) {
      errors.push(`image "${src}": unknown title "${title}" — leave it out, or use "${SIDE_IMAGE_TITLE}" to show the image next to the text before it`);
    } else if (title === SIDE_IMAGE_TITLE) {
      const sideError = sideImageError(markdown, image);
      if (sideError) errors.push(sideError);
    }
    if (!isBriefImageSrc(src)) {
      errors.push(`image "${src}": use a file in public/challenges/, written as /challenges/<file>.png (or .jpg, .webp, .avif; lowercase)`);
      continue;
    }
    if (!alt) errors.push(`image "${src}": needs alt text — ![what the image shows](${src})`);
    if (!exists(src.slice("/challenges/".length))) errors.push(`image "${src}" not found in public/challenges/`);
  }
  return errors;
}
