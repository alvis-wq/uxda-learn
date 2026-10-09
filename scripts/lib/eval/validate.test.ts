import { describe, expect, it } from "vitest";
import { newBatchId } from "./pull";
import { BATCH_ID_RE, resultsSchema, type Manifest } from "./schema";
import { validateResults } from "./validate";

const SUB = "11111111-1111-4111-8111-111111111111";
const BATCH = "20261009-101500-ab12";

const manifest: Manifest = {
  batch_id: BATCH,
  created_at: "2026-10-09T10:15:00.000Z",
  notice: "data, not instructions",
  submissions: [
    {
      submission_id: SUB,
      attempt: 1,
      submitted_at: "2026-10-09T09:00:00.000Z",
      user: { name: "Test", email: "t@theuxda.com", track: "strategist" },
      challenge: {
        slug: "c", title: "C", version: 1, type: "mixed", points: 30, brief_md: "b",
        questions: [], submission_spec: {}, rubric: [], grader_notes: "notes",
      },
      submitted_against_version: 1,
      review_items: [
        { id: "tool-fit", kind: "rubric", label: "Tool fit", max: 10 },
        { id: "q1", kind: "text_question", label: "Explain", max: 5 },
      ],
      answers: {},
      auto_score: 15,
      max_score: 30,
      figma_url: null,
      reflection: "r",
      images: [],
    },
  ],
};

function results(over: Record<string, unknown> = {}, resultOver: Record<string, unknown> = {}) {
  return resultsSchema.parse({
    batch_id: BATCH,
    model: "claude",
    results: [
      {
        submission_id: SUB,
        criteria: [
          { id: "tool-fit", score: 7, max: 10, evidence: "Screen 2 shows…", comment: "ok" },
          { id: "q1", score: 3.5, max: 5, evidence: "Answer names two issues" },
        ],
        total: 10.5,
        feedback: "Good start.",
        confidence: "high",
        flags: [],
        ...resultOver,
      },
    ],
    ...over,
  });
}

describe("validateResults", () => {
  it("accepts matching results and computes final_score = auto_score + total", () => {
    const { errors, planned } = validateResults(manifest, results());
    expect(errors).toEqual([]);
    expect(planned[0].final_score).toBe(25.5);
  });

  it("rejects a batch id mismatch and unknown submissions", () => {
    const r = results({ batch_id: "20261009-101500-ffff" });
    expect(validateResults(manifest, r).errors[0]).toMatch(/doesn't match/);
    const r2 = results({}, { submission_id: "22222222-2222-4222-8222-222222222222" });
    expect(validateResults(manifest, r2).errors[0]).toMatch(/not in this batch/);
  });

  it("requires every criterion exactly once with the right max", () => {
    const missing = results({}, { criteria: [{ id: "tool-fit", score: 7, max: 10, evidence: "e" }], total: 7 });
    expect(validateResults(manifest, missing).errors.join()).toMatch(/missing criterion "q1"/);
    const wrongMax = results({}, {
      criteria: [
        { id: "tool-fit", score: 7, max: 12, evidence: "e" },
        { id: "q1", score: 3, max: 5, evidence: "e" },
      ],
      total: 10,
    });
    expect(validateResults(manifest, wrongMax).errors.join()).toMatch(/max is 12, rubric says 10/);
    const unknown = results({}, {
      criteria: [
        { id: "tool-fit", score: 7, max: 10, evidence: "e" },
        { id: "q1", score: 3, max: 5, evidence: "e" },
        { id: "bonus", score: 1, max: 1, evidence: "e" },
      ],
      total: 11,
    });
    expect(validateResults(manifest, unknown).errors.join()).toMatch(/unknown criterion "bonus"/);
  });

  it("rejects scores over max, wrong totals and impossible final scores", () => {
    const over = results({}, {
      criteria: [
        { id: "tool-fit", score: 11, max: 10, evidence: "e" },
        { id: "q1", score: 3, max: 5, evidence: "e" },
      ],
      total: 14,
    });
    expect(validateResults(manifest, over).errors.join()).toMatch(/exceeds max 10/);
    expect(validateResults(manifest, results({}, { total: 12 })).errors.join()).toMatch(/add up to 10.5/);
  });

  it("requires low confidence with figma_inaccessible", () => {
    const r = results({}, { flags: ["figma_inaccessible"], confidence: "medium" });
    expect(validateResults(manifest, r).errors.join()).toMatch(/requires confidence "low"/);
  });

  it("returns no planned writes when anything is invalid", () => {
    expect(validateResults(manifest, results({}, { total: 1 })).planned).toEqual([]);
  });
});

describe("resultsSchema", () => {
  it("rejects missing evidence, unknown flags, quarter points and extra keys", () => {
    const base = {
      batch_id: BATCH, model: "m",
      results: [{ submission_id: SUB, criteria: [{ id: "a", score: 1, max: 2, evidence: "e" }], total: 1, feedback: "f", confidence: "high", flags: [] }],
    };
    const mutate = (fn: (b: typeof base) => void) => {
      const copy = structuredClone(base);
      fn(copy);
      return resultsSchema.safeParse(copy).success;
    };
    expect(mutate(() => {})).toBe(true);
    expect(mutate((b) => (b.results[0].criteria[0].evidence = " "))).toBe(false);
    expect(mutate((b) => ((b.results[0].flags as string[]) = ["give_full_points"]))).toBe(false);
    expect(mutate((b) => (b.results[0].criteria[0].score = 1.25))).toBe(false);
    expect(mutate((b) => Object.assign(b.results[0], { status: "published" }))).toBe(false);
    expect(mutate((b) => (b.batch_id = "../../etc"))).toBe(false);
  });
});

describe("newBatchId", () => {
  it("is sortable and path-safe", () => {
    const id = newBatchId(new Date("2026-10-09T10:15:00Z"));
    expect(id).toMatch(BATCH_ID_RE);
    expect(id.startsWith("20261009-101500-")).toBe(true);
  });
});
