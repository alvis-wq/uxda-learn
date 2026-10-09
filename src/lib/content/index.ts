import { loadContent, type LoadedContent, type ContentError } from "./load";
import { validateContent } from "./validate";

export * from "./schema";
export type { ContentError, LoadedContent, LoadedChallenge } from "./load";

/** Load + validate a content directory. */
export function loadAndValidate(contentDir: string): { content: LoadedContent; errors: ContentError[] } {
  const content = loadContent(contentDir);
  return { content, errors: validateContent(content) };
}
