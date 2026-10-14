/** Validate /content (or the dir given as the first argument). Exit 1 on any error. */
import { loadAndValidate } from "../src/lib/content";

const dir = process.argv[2] ?? "content";
const { content, errors } = loadAndValidate(dir);

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  ${e.file}: ${e.message}`);
  process.exit(1);
}

const byStatus = content.challenges.reduce<Record<string, number>>((acc, c) => {
  acc[c.data.status] = (acc[c.data.status] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `Content OK: ${content.categories.length} categories, ${content.challenges.length} challenges ` +
    `(${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ") || "none"}), ` +
    `${content.paths.length} ${content.paths.length === 1 ? "path" : "paths"}.`,
);
