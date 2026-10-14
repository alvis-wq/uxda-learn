import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

describe("dependency audit in CI", () => {
  it("fails only on high or critical advisories, in production dependencies only", () => {
    expect(pkg.scripts["audit:prod"]).toBe("npm audit --omit=dev --audit-level=high");
  });

  it("runs as a CI step", () => {
    expect(ci).toMatch(/- name: Audit production dependencies\n\s+run: npm run audit:prod/);
  });

  it("runs after typecheck, tests and build, so an advisory never hides those failures", () => {
    const at = (needle: string) => ci.indexOf(needle);
    expect(at("npm run audit:prod")).toBeGreaterThan(at("run: npm run build"));
    expect(at("run: npm run build")).toBeGreaterThan(at("run: npm run check"));
  });
});
