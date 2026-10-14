import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const createClient = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

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

  it("both submit forms open the attempt page when the quiz was graded on the spot", () => {
    for (const f of ["challenge-form", "stepped-challenge-form"]) {
      const src = read(`src/app/(app)/challenges/[slug]/${f}.tsx`);
      expect(src, f).toMatch(/res\.status === "published"[\s\S]*router\.push\(`\/submissions\/\$\{res\.submissionId\}`\)/);
    }
  });
});

describe("getLearnerAttemptResults: when the answer key is shown", () => {
  const challenge = {
    version: 2,
    questions: [{ id: "q1", kind: "single", prompt: "P", points: 5, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }],
  } as never;
  const sub = (is_test: boolean) => ({ challenge_slug: "demo", challenge_version: 2, answers: { q1: "b" }, is_test });
  const filtersSeen: [string, unknown][] = [];

  function mockDb(attempts: Record<string, unknown>[]) {
    filtersSeen.length = 0;
    createAdminClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { answer_key: { q1: "a" } }, error: null }) }) }) }),
    });
    createClient.mockResolvedValue({
      from: () => {
        const builder = {
          select: () => builder,
          eq: (k: string, v: unknown) => (filtersSeen.push([k, v]), builder),
          then: (resolve: (v: unknown) => unknown) => resolve({ data: attempts, error: null }),
        };
        return builder;
      },
    });
  }

  let getLearnerAttemptResults: typeof import("./attempt-results").getLearnerAttemptResults;
  beforeEach(async () => {
    vi.clearAllMocks();
    ({ getLearnerAttemptResults } = await import("./attempt-results"));
  });

  it("a test attempt always carries the right answer, whatever the attempts used", async () => {
    mockDb([]);
    const view = await getLearnerAttemptResults("u1", sub(true), challenge);
    expect(view).toMatchObject({ state: "ready", reveal: { reveal: true }, results: [{ correct: false, correctOptionIds: ["a"] }] });
    expect(createClient).not.toHaveBeenCalled(); // no need to look at their other attempts
  });

  it("a REAL attempt follows the normal rules, even for a tester: hidden with attempts left", async () => {
    mockDb([{ status: "published", final_score: 0, max_score: 5 }]);
    const view = await getLearnerAttemptResults("u1", sub(false), challenge);
    expect(view).toMatchObject({ state: "ready", reveal: { reveal: false, attemptsLeft: 2 }, results: [{ correct: false, correctOptionIds: null }] });
  });

  it("only real attempts are counted for the reveal (test attempts neither open the key nor use attempts up)", async () => {
    mockDb([]);
    await getLearnerAttemptResults("u1", sub(false), challenge);
    expect(filtersSeen).toContainEqual(["is_test", false]);
  });

  it("a real attempt opens the key with full marks or all 3 attempts used", async () => {
    mockDb([{ status: "published", final_score: 5, max_score: 5 }]);
    expect(await getLearnerAttemptResults("u1", sub(false), challenge)).toMatchObject({ reveal: { reveal: true } });
    mockDb([1, 2, 3].map(() => ({ status: "published", final_score: 0, max_score: 5 })));
    expect(await getLearnerAttemptResults("u1", sub(false), challenge)).toMatchObject({ reveal: { reveal: true } });
  });
});

