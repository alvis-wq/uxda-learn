import { loadContent, type LoadedContent, type ContentError } from "./load";
import { contentWarnings, validateContent } from "./validate";

export * from "./schema";
export type { ContentError, LoadedContent, LoadedChallenge, LoadedPath } from "./load";

/** Load + validate a content directory. Warnings never block; errors do. */
export function loadAndValidate(contentDir: string): {
  content: LoadedContent;
  errors: ContentError[];
  warnings: ContentError[];
} {
  const content = loadContent(contentDir);
  return { content, errors: validateContent(content), warnings: contentWarnings(content) };
}
