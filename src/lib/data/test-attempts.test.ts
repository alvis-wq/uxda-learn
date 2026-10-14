import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test attempts (is_test) must never reach points, completed counts, required progress, exports or reviews. Every
 * read of the submissions table in the app and the scripts therefore has to say what it does about them: filter on
 * is_test, or carry a `// is_test:` comment explaining why it needn't. A new read that forgets fails here.
 */
const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Tooling that writes or wipes rows on purpose: the database check inserts test attempts itself, and the user reset
// deletes everything a user made, test attempts included.
const TOOLING = ["scripts/check-db.ts", "scripts/reset-user-data.ts"];

const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "scripts"))].filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !f.endsWith("database.types.ts") &&
    !TOOLING.includes(path.relative(ROOT, f)),
);

describe("every read of the submissions table deals with test attempts", () => {
  const reads: { file: string; line: number; window: string }[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      // `.storage.from("submissions")` is the Storage bucket, not the table (the chain can be split over two lines).
      const bucket = /storage/.test(text) || /storage\s*$/.test(lines[i - 1] ?? "");
      if (/\.from\(["']submissions["']\)/.test(text) && !bucket) {
        reads.push({ file: path.relative(ROOT, file), line: i + 1, window: lines.slice(Math.max(0, i - 3), i + 10).join("\n") });
      }
    });
  }

  it("finds the reads (the scan itself works)", () => {
    expect(reads.length).toBeGreaterThan(10);
  });

  // Reads by id or on the learner's own challenge page / attempt page are about ONE row and say so.
  const ONE_ROW = /\.eq\(["']id["']|\.in\(["']id["']|is_test|\/\/ is_test:/;

  for (const r of reads) {
    it(`${r.file}:${r.line}`, () => {
      expect(r.window, "filter on is_test, or add a `// is_test:` comment saying why not").toMatch(ONE_ROW);
    });
  }
});
