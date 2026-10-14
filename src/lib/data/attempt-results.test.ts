import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../..", p), "utf8");

describe("where the right answers can come from", () => {
  it("the learner's attempt page only uses the gated loader", () => {
    const page = read("src/app/(app)/submissions/[id]/page.tsx");
    expect(page).toContain("getLearnerAttemptResults");
    expect(page).not.toContain("getAdminAttemptResults");
    expect(page).not.toContain("challenge_keys");
  });

  it("only the admin review page gets the always-reveal loader", () => {
    expect(read("src/app/(admin)/admin/submissions/[id]/page.tsx")).toContain("getAdminAttemptResults");
  });

  it("the loader is server-only and the key is read with the service role", () => {
    const src = read("src/lib/data/attempt-results.ts");
    expect(src).toContain('import "server-only"');
    expect(src).toContain("createAdminClient().from(\"challenge_keys\")");
  });

  it("the answers component is a server component, so the key never ships as client code", () => {
    expect(read("src/components/submission-answers.tsx")).not.toMatch(/^["']use client["']/);
  });
});
