import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitQuiz, type QuizDraft } from "@/lib/academy/quiz";

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
const createAdminClient = vi.fn();
const revalidatePath = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser, getCurrentProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { getAcademyQuiz, submitAcademyQuiz } = await import("./actions");

type Row = Record<string, unknown>;
const RES = "5b0c4b1e-9a51-4f5e-8f6a-2b9d6f0f8c11";
const USER = { id: "11111111-1111-4111-8111-111111111111" };

/** The supabase-js calls the actions make, over in-memory tables. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; row: Row }[] = [];
  return {
    writes,
    client: {
      from(table: string) {
        const filters: ((r: Row) => boolean)[] = [];
        const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        const builder = {
          select: () => builder,
          eq: (k: string, v: unknown) => {
            filters.push((r) => r[k] === v);
            return builder;
          },
          maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
          insert: async (row: Row) => {
            writes.push({ table, op: "insert", row });
            (tables[table] ??= []).push(row);
            return { error: null };
          },
          upsert: async (row: Row) => {
            writes.push({ table, op: "upsert", row });
            return { error: null };
          },
        };
        return builder;
      },
    },
  };
}

const draft: QuizDraft = Array.from({ length: 5 }, (_, i) => ({ prompt: `Q${i}?`, options: [`r${i}`, "x", "y", "z"], answer: 0 }));
const { questions, answerKey } = splitQuiz(draft);
const right = Object.fromEntries(questions.map((q) => [q.id, answerKey[q.id]]));
const wrongFor = (id: string) => questions.find((q) => q.id === id)!.options.find((o) => o.id !== answerKey[id])!.id;

let db: ReturnType<typeof fakeDb>;
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(USER);
  getCurrentProfile.mockResolvedValue({ id: USER.id, track: "designer" });
  db = fakeDb({
    academy_resources: [{ id: RES, status: "published", questions }],
    academy_quiz_keys: [{ resource_id: RES, answer_key: answerKey }],
    academy_completions: [],
  });
  createAdminClient.mockReturnValue(db.client);
});

describe("getAcademyQuiz", () => {
  it("returns the questions without the key", async () => {
    const res = await getAcademyQuiz(RES);
    expect(res).toEqual({ ok: true, questions, done: false });
    expect(JSON.stringify(res)).not.toContain('"answer');
  });

  it("refuses a signed-out user, a bad id and an unpublished resource", async () => {
    await expect(getAcademyQuiz("nope")).resolves.toMatchObject({ ok: false });
    db = fakeDb({ academy_resources: [{ id: RES, status: "draft", questions }], academy_completions: [] });
    createAdminClient.mockReturnValue(db.client);
    await expect(getAcademyQuiz(RES)).resolves.toMatchObject({ ok: false });
    getCurrentUser.mockResolvedValue(null);
    await expect(getAcademyQuiz(RES)).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/sign in/) });
  });
});

describe("submitAcademyQuiz", () => {
  it("completes the resource at 4 of 5 and records the try", async () => {
    const res = await submitAcademyQuiz(RES, { ...right, q3: wrongFor("q3") });
    expect(res).toEqual({ ok: true, correct: 4, total: 5, passed: true, wrong: ["q3"] });
    expect(db.writes).toEqual([
      { table: "academy_quiz_attempts", op: "insert", row: { user_id: USER.id, resource_id: RES, correct: 4, passed: true } },
      { table: "academy_completions", op: "upsert", row: { user_id: USER.id, resource_id: RES } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/academy");
  });

  it("doesn't complete it below 4, and never returns the answers", async () => {
    const res = await submitAcademyQuiz(RES, { ...right, q1: wrongFor("q1"), q2: wrongFor("q2") });
    expect(res).toEqual({ ok: true, correct: 3, total: 5, passed: false, wrong: ["q1", "q2"] });
    expect(db.writes.map((w) => w.table)).toEqual(["academy_quiz_attempts"]);
    for (const q of questions) expect(JSON.stringify(res)).not.toContain(`"${answerKey[q.id]}"`);
  });

  it("refuses bad input and a signed-out user without writing", async () => {
    await expect(submitAcademyQuiz(RES, "nope")).resolves.toMatchObject({ ok: false });
    await expect(submitAcademyQuiz("nope", right)).resolves.toMatchObject({ ok: false });
    getCurrentUser.mockResolvedValue(null);
    await expect(submitAcademyQuiz(RES, right)).resolves.toMatchObject({ ok: false });
    expect(db.writes).toEqual([]);
  });

  it("refuses a resource that isn't published", async () => {
    db = fakeDb({ academy_resources: [{ id: RES, status: "archived", questions }], academy_quiz_keys: [{ resource_id: RES, answer_key: answerKey }] });
    createAdminClient.mockReturnValue(db.client);
    await expect(submitAcademyQuiz(RES, right)).resolves.toMatchObject({ ok: false });
    expect(db.writes).toEqual([]);
  });
});
