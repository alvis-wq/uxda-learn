import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizDraft } from "./quiz";

const getAcademyEditorOrNull = vi.fn();
const createAdminClient = vi.fn();
const draftQuiz = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/academy-editor", () => ({ getAcademyEditorOrNull }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./quiz-ai", () => ({ draftQuiz, QuizDraftError: class extends Error {} }));

const actions = await import("./manage-actions");

type Row = Record<string, unknown>;
const EDITOR = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
const BLOG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Just enough of supabase-js over in-memory tables, recording writes. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; row: Row }[] = [];
  const client = {
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      let op: { kind: string; row?: Row } | null = null;
      const run = () => {
        if (op?.kind === "update") for (const r of rows()) Object.assign(r, op.row);
        if (op?.kind === "delete") tables[table] = (tables[table] ?? []).filter((r) => !filters.every((f) => f(r)));
        return { data: rows(), error: null, count: rows().length };
      };
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), builder),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => {
          const row = { id: "new-id", ...op!.row };
          (tables[table] ??= []).push(row);
          return { data: row, error: null };
        },
        insert: (row: Row) => (writes.push({ table, op: "insert", row }), (op = { kind: "insert", row }), builder),
        update: (row: Row) => (writes.push({ table, op: "update", row }), (op = { kind: "update", row }), builder),
        upsert: async (row: Row) => (writes.push({ table, op: "upsert", row }), { error: null }),
        delete: () => ((op = { kind: "delete" }), builder),
        then: (resolve: (v: unknown) => unknown) => resolve(run()),
      };
      return builder;
    },
  };
  return { client, writes, tables };
}

const quiz: QuizDraft = Array.from({ length: 5 }, (_, i) => ({ prompt: `Q${i}?`, options: [`right${i}`, "b", "c", "d"], answer: 0 }));
let db: ReturnType<typeof fakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
  getAcademyEditorOrNull.mockResolvedValue(EDITOR);
  db = fakeDb({
    academy_resources: [
      { id: BLOG, kind: "blog", title: "Post", url: "https://theuxda.com/blog/a", status: "draft", questions: [], published_at: null, blog_id: null },
      { id: POD, kind: "podcast", title: "Ep", url: "https://pod.example/1", status: "draft", questions: [], published_at: null, blog_id: BLOG },
    ],
    academy_completions: [],
    academy_quiz_attempts: [],
  });
  createAdminClient.mockReturnValue(db.client);
});

describe("role check", () => {
  it("refuses everyone who isn't an Academy editor or admin, before touching anything", async () => {
    getAcademyEditorOrNull.mockResolvedValue(null);
    const results = await Promise.all([
      actions.previewLink("blog", "https://theuxda.com/blog/a"),
      actions.createResource({ kind: "blog", title: "x", url: "https://x.com", image: { type: "none" } }),
      actions.updateResource(BLOG, { kind: "blog", title: "x", url: "https://x.com", image: { type: "keep" } }),
      actions.draftQuizWithAI(BLOG),
      actions.saveQuiz(BLOG, quiz),
      actions.markQuizReviewed(BLOG),
      actions.setResourceStatus(BLOG, "published"),
      actions.deleteDraftResource(BLOG),
      actions.uploadAcademyImage(new FormData()),
    ]);
    for (const r of results) expect(r).toEqual({ ok: false, error: "Only Academy editors and admins can do this." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("createResource", () => {
  it("saves a draft with the editor as author", async () => {
    const res = await actions.createResource({ kind: "blog", title: " New post ", url: "https://theuxda.com/blog/b", description: "", image: { type: "none" } });
    expect(res).toEqual({ ok: true, data: { id: "new-id" } });
    expect(db.writes[0]).toMatchObject({ table: "academy_resources", op: "insert", row: { kind: "blog", title: "New post", description: null, created_by: EDITOR.id, blog_id: null, image_path: null } });
  });

  it("needs a link for posts and podcasts, but not for books", async () => {
    await expect(actions.createResource({ kind: "blog", title: "x", url: "", image: { type: "none" } })).resolves.toMatchObject({ ok: false });
    await expect(actions.createResource({ kind: "book", title: "A book", url: "", image: { type: "none" } })).resolves.toMatchObject({ ok: true });
  });

  it("won't link a podcast to a post that already has an episode, or to something that isn't a post", async () => {
    await expect(actions.createResource({ kind: "podcast", title: "Ep 2", url: "https://pod.example/2", blogId: BLOG, image: { type: "none" } })).resolves.toEqual({
      ok: false,
      error: "That blog post already has a podcast episode.",
    });
    await expect(actions.createResource({ kind: "podcast", title: "Ep 2", url: "https://pod.example/2", blogId: POD, image: { type: "none" } })).resolves.toEqual({
      ok: false,
      error: "Choose a blog post for this episode.",
    });
  });

  it("only accepts picture paths this module wrote", async () => {
    await expect(actions.createResource({ kind: "book", title: "B", image: { type: "path", path: "../../etc/passwd" } })).resolves.toMatchObject({ ok: false });
  });
});

describe("saveQuiz", () => {
  it("stores the questions without answers and the key apart, and marks it checked", async () => {
    await expect(actions.saveQuiz(BLOG, quiz)).resolves.toEqual({ ok: true });
    const key = db.writes.find((w) => w.table === "academy_quiz_keys")!.row;
    const update = db.writes.find((w) => w.table === "academy_resources")!.row as { questions: { id: string; options: { id: string; label: string }[] }[]; quiz_reviewed: boolean };
    expect(update.quiz_reviewed).toBe(true);
    expect(JSON.stringify(update.questions)).not.toContain("answer");
    const answers = (key.answer_key as Record<string, string>);
    update.questions.forEach((q, i) => expect(q.options.find((o) => o.id === answers[q.id])?.label).toBe(`right${i}`));
  });

  it("refuses an incomplete quiz", async () => {
    await expect(actions.saveQuiz(BLOG, quiz.slice(0, 4))).resolves.toMatchObject({ ok: false });
    expect(db.writes).toEqual([]);
  });
});

describe("setResourceStatus", () => {
  it("won't publish without a quiz", async () => {
    await expect(actions.setResourceStatus(BLOG, "published")).resolves.toEqual({ ok: false, error: "Add the 5 quiz questions before publishing." });
  });

  it("publishes with a quiz and stamps published_at once", async () => {
    db.tables.academy_resources[0].questions = [1, 2, 3, 4, 5];
    await expect(actions.setResourceStatus(BLOG, "published")).resolves.toEqual({ ok: true });
    expect(db.tables.academy_resources[0]).toMatchObject({ status: "published", published_at: expect.any(String) });
  });
});

describe("deleteDraftResource", () => {
  it("refuses a post with a linked episode, and anything that has been tried", async () => {
    await expect(actions.deleteDraftResource(BLOG)).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/podcast/) });
    db.tables.academy_quiz_attempts.push({ id: "t", resource_id: POD });
    await expect(actions.deleteDraftResource(POD)).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/Archive/) });
  });
});
