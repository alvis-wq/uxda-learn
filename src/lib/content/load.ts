import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type { z } from "zod";
import {
  categoriesFileSchema,
  challengeFrontmatterSchema,
  pathFileSchema,
  type Category,
  type ChallengeFrontmatter,
  type PathFile,
} from "./schema";

export type ContentError = { file: string; message: string };

export type LoadedChallenge = {
  file: string; // relative to the content dir, e.g. challenges/foo.md
  data: ChallengeFrontmatter;
  body: string;
};

export type LoadedPath = {
  file: string; // relative to the content dir, e.g. paths/foo.yaml
  data: PathFile;
};

export type LoadedContent = {
  categories: Category[];
  challenges: LoadedChallenge[];
  paths: LoadedPath[];
  errors: ContentError[];
};

const yamlEngine = {
  parse: (src: string) => YAML.parse(src) as object,
  stringify: (obj: object) => YAML.stringify(obj),
};

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}

/** Load and schema-parse every content file. Cross-file rules live in validate.ts. */
export function loadContent(contentDir: string): LoadedContent {
  const errors: ContentError[] = [];
  const categories: Category[] = [];
  const challenges: LoadedChallenge[] = [];

  const catFile = "categories.yaml";
  const catPath = path.join(contentDir, catFile);
  if (!existsSync(catPath)) {
    errors.push({ file: catFile, message: "file not found" });
  } else {
    try {
      const parsed = categoriesFileSchema.safeParse(YAML.parse(readFileSync(catPath, "utf8")));
      if (parsed.success) categories.push(...parsed.data.categories);
      else for (const m of formatZodIssues(parsed.error)) errors.push({ file: catFile, message: m });
    } catch (err) {
      errors.push({ file: catFile, message: `invalid YAML: ${(err as Error).message}` });
    }
  }

  const chDir = path.join(contentDir, "challenges");
  const files = existsSync(chDir)
    ? readdirSync(chDir).filter((f) => f.endsWith(".md")).sort()
    : [];
  for (const name of files) {
    const file = `challenges/${name}`;
    let fm: unknown;
    let body: string;
    try {
      // Pass an options object so gray-matter doesn't serve a cached parse.
      const parsed = matter(readFileSync(path.join(chDir, name), "utf8"), {
        engines: { yaml: yamlEngine },
      });
      fm = parsed.data;
      body = parsed.content.trim();
    } catch (err) {
      errors.push({ file, message: `invalid frontmatter: ${(err as Error).message}` });
      continue;
    }
    const result = challengeFrontmatterSchema.safeParse(fm);
    if (!result.success) {
      for (const m of formatZodIssues(result.error)) errors.push({ file, message: m });
      continue;
    }
    challenges.push({ file, data: result.data, body });
  }

  const paths: LoadedPath[] = [];
  const pathDir = path.join(contentDir, "paths");
  const pathFiles = existsSync(pathDir)
    ? readdirSync(pathDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).sort()
    : [];
  for (const name of pathFiles) {
    const file = `paths/${name}`;
    let raw: unknown;
    try {
      raw = YAML.parse(readFileSync(path.join(pathDir, name), "utf8"));
    } catch (err) {
      errors.push({ file, message: `invalid YAML: ${(err as Error).message}` });
      continue;
    }
    const result = pathFileSchema.safeParse(raw);
    if (!result.success) {
      for (const m of formatZodIssues(result.error)) errors.push({ file, message: m });
      continue;
    }
    paths.push({ file, data: result.data });
  }

  return { categories, challenges, paths, errors };
}
