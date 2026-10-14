/**
 * Images in briefs: markdown `![alt text](/challenges/file.png)`, served from public/challenges/ (the same folder as
 * card artwork). Only those are shown — anything else (another site, another folder) is not rendered — and
 * content:validate requires alt text and an existing file. Kept free of Node imports: the Markdown component uses it.
 */
export const BRIEF_IMAGE_SRC = /^\/challenges\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/;

export function isBriefImageSrc(src: string | null | undefined): src is string {
  return typeof src === "string" && BRIEF_IMAGE_SRC.test(src);
}

export type MarkdownImage = { alt: string; src: string };

/** Every `![alt](src "optional title")` in a markdown text. */
export function markdownImages(markdown: string): MarkdownImage[] {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+["'][^"']*["'])?\s*\)/g)].map((m) => ({ alt: m[1].trim(), src: m[2] }));
}

/** Problems with a brief's images (no alt text, not in public/challenges/, missing file), as validation messages. */
export function briefImageErrors(markdown: string, exists: (file: string) => boolean): string[] {
  const errors: string[] = [];
  for (const { alt, src } of markdownImages(markdown)) {
    if (!isBriefImageSrc(src)) {
      errors.push(`image "${src}": use a file in public/challenges/, written as /challenges/<file>.png (or .jpg, .webp, .avif; lowercase)`);
      continue;
    }
    if (!alt) errors.push(`image "${src}": needs alt text — ![what the image shows](${src})`);
    if (!exists(src.slice("/challenges/".length))) errors.push(`image "${src}" not found in public/challenges/`);
  }
  return errors;
}
