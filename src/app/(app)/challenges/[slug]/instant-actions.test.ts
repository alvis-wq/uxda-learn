import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getCurrentProfile = vi.fn();
const createAdminClient = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser, getCurrentProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { checkInstantAnswer } = await import("./instant-actions");
const { submitChallenge } = await import("./actions");
const { saveDraft } = await import("./draft-actions");

type Row = Record<string, unknown>;
type Run = { test: boolean; questions: Record<string, { tries: number; solved: boolean }> };

/**
 * In-memory stand-in for the supabase-js calls the action makes, including a twin of record_instant_try (count one
 * check; a solved question stays solved; a run of the other kind starts over).
 */
function fakeDb(tables: Record<string, Row[]>) {
  const inserts: { table: string; row: Row }[] = [];
  const rpcCalls: Row[] = [];
  const client = {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      let pendingInsert: Row | null = null;
      let pendingUpdate: Row | null = null;
      let deleting = false;
      const apply = () => {
        if (pendingUpdate) for (const r of rows()) Object.assign(r, pendingUpdate);
        if (deleting) tables[table] = (tables[table] ?? []).filter((r) => !filters.every((f) => f(r)));
        return { data: rows(), error: null };
      };
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), builder),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), builder),
        then: (resolve: (v: unknown) => unknown) => resolve(apply()),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => {
          if (pendingInsert) {
            const clash = (tables[table] ?? []).some(
              (r) => r.user_id === pendingInsert!.user_id && r.challenge_slug === pendingInsert!.challenge_slug && r.attempt === pendingInsert!.attempt && r.is_test === pendingInsert!.is_test,
            );
            if (clash) return { data: null, error: { code: "23505", message: "duplicate" } };
            const row = { id: `sub-${inserts.length + 1}`, ...pendingInsert };
            (tables[table] ??= []).push(row);
            inserts.push({ table, row });
            return { data: row, error: null };
          }
          return { data: rows()[0] ?? null, error: rows()[0] ? null : { message: "none" } };
        },
        insert: (row: Row) => ((pendingInsert = row), builder),
        update: (row: Row) => ((pendingUpdate = row), builder),
        delete: () => ((deleting = true), builder),
      };
      return builder;
    },
    async rpc(name: string, args: Row) {
      rpcCalls.push({ name, ...args });
      const drafts = (tables.submission_drafts ??= []);
      let draft = drafts.find((d) => d.user_id === args.p_user && d.challenge_slug === args.p_challenge);
      if (!draft) drafts.push((draft = { user_id: args.p_user, challenge_slug: args.p_challenge, current_step: 1, instant_tries: null }));
      let run = draft.instant_tries as Run | null;
      if (!run || run.test !== args.p_is_test) run = { test: args.p_is_test as boolean, questions: {} };
      const id = args.p_question as string;
      const was = run.questions[id];
      run = { ...run, questions: { ...run.questions, [id]: was?.solved ? was : { tries: (was?.tries ?? 0) + 1, solved: args.p_correct as boolean } } };
      draft.instant_tries = run;
      return { data: run, error: null };
    },
  };
  return { client, tables, inserts, rpcCalls };
}

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const profile = (tester = false) => ({ id: USER.id, track: "strategist", is_admin: false, is_tester: tester });

const quiz = (over: Row = {}): Row => ({
  slug: "check",
  category_slug: "wf",
  path_slug: null,
  type: "quiz",
  feedback_mode: "instant",
  status: "published",
  audiences: ["strategist"],
  version: 2,
  points: 6,
  questions: [
    { id: "q1", kind: "single", prompt: "One?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], points: 2 },
    {
      id: "q2", kind: "match", prompt: "Match", points: 4, one_per_category: true,
      categories: [{ id: "c1", label: "C1" }, { id: "c2", label: "C2" }],
      items: [{ id: "x", label: "X" }, { id: "y", label: "Y" }],
    },
  ],
  submission_spec: {},
  rubric: [],
  ...over,
});

function setup(challenge: Row = quiz(), submissions: Row[] = [], drafts: Row[] = []) {
  const db = fakeDb({
    challenges: [challenge],
    categories: [{ slug: "wf", archived: false, audiences: ["strategist"] }],
    challenge_keys: [{ challenge_slug: "check", answer_key: { q1: "b", q2: ["x=c1", "y=c2"] }, explanations: { q1: "Because B.", q2: "Pairs." } }],
    submissions,
    submission_drafts: drafts,
  });
  createAdminClient.mockReturnValue(db.client);
  return db;
}

const check = (questionId: string, answer: string | string[], version = 2) => checkInstantAnswer("check", { version, questionId, answer });

describe("checkInstantAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile());
  });

  it("requires a session and never touches the DB without one", async () => {
    getCurrentUser.mockResolvedValue(null);
    getCurrentProfile.mockResolvedValue(null);
    await expect(check("q1", "b")).resolves.toMatchObject({ ok: false });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("says wrong without the answer or the explanation, and counts the try", async () => {
    const db = setup();
    const res = await check("q1", "a");
    expect(res).toEqual({ ok: true, correct: false });
    expect(JSON.stringify(res)).not.toContain("Because");
    expect(db.rpcCalls).toMatchObject([{ p_user: USER.id, p_question: "q1", p_correct: false, p_is_test: false }]);
  });

  it("gives the explanation once the answer is right, without publishing before the last question", async () => {
    const db = setup();
    await expect(check("q1", "b")).resolves.toEqual({ ok: true, correct: true, explanation: "Because B.", submissionId: null });
    expect(db.inserts).toEqual([]);
    expect(db.tables.submission_drafts[0].current_step).toBe(2);
  });

  it("publishes after the last question, scored from the tries: full, then half", async () => {
    const db = setup();
    await check("q1", "b"); // first try: 2 of 2
    await check("q2", ["x=c2", "y=c1"]); // wrong
    const done = await check("q2", ["y=c2", "x=c1"]); // second try: 2 of 4 (pairs in any order)
    expect(done).toEqual({ ok: true, correct: true, explanation: "Pairs.", submissionId: "sub-1" });
    expect(db.inserts[0].row).toMatchObject({
      user_id: USER.id,
      challenge_slug: "check",
      challenge_version: 2,
      attempt: 1,
      is_test: false,
      status: "published",
      auto_score: 4,
      final_score: 4,
      max_score: 6,
      question_tries: { q1: 1, q2: 2 },
      answers: { q1: "b", q2: ["x=c1", "y=c2"] },
    });
    // The run is gone with the draft.
    expect(db.tables.submission_drafts).toEqual([]);
  });

  it("scores nothing for a question solved on the third try or later", async () => {
    const db = setup();
    await check("q1", "a");
    await check("q1", "a");
    await check("q1", "b");
    await check("q2", ["x=c1", "y=c2"]);
    expect(db.inserts[0].row).toMatchObject({ final_score: 4, question_tries: { q1: 3, q2: 1 } });
  });

  it("never counts a solved question again", async () => {
    const db = setup();
    await check("q1", "b");
    await expect(check("q1", "a")).resolves.toMatchObject({ ok: true, correct: true });
    expect((db.tables.submission_drafts[0].instant_tries as Run).questions.q1).toEqual({ tries: 1, solved: true });
  });

  it("allows one real attempt only", async () => {
    const db = setup(quiz(), [{ user_id: USER.id, challenge_slug: "check", attempt: 1, status: "published", final_score: 2, max_score: 6, is_test: false }]);
    await expect(check("q1", "b")).resolves.toEqual({ ok: false, error: "This quiz has one attempt, and you've completed it." });
    expect(db.rpcCalls).toEqual([]);
  });

  it("gives a tester unlimited test attempts on a draft, numbered on their own", async () => {
    getCurrentProfile.mockResolvedValue(profile(true));
    const earlier = { user_id: USER.id, challenge_slug: "check", attempt: 1, status: "published", final_score: 6, max_score: 6, is_test: true };
    const db = setup(quiz({ status: "draft" }), [earlier]);
    await check("q1", "b");
    await check("q2", ["x=c1", "y=c2"]);
    expect(db.rpcCalls[0]).toMatchObject({ p_is_test: true });
    expect(db.inserts[0].row).toMatchObject({ is_test: true, attempt: 2, final_score: 6 });
  });

  it("starts a real run fresh when a test run was left behind", async () => {
    const leftover = { user_id: USER.id, challenge_slug: "check", instant_tries: { test: true, questions: { q1: { tries: 5, solved: false } } } };
    const db = setup(quiz(), [], [leftover]);
    await check("q1", "b");
    await check("q2", ["x=c1", "y=c2"]);
    expect(db.inserts[0].row).toMatchObject({ final_score: 6, question_tries: { q1: 1, q2: 1 } });
  });

  it.each([
    ["a final-mode challenge", quiz({ feedback_mode: "final" }), "q1", "b", "This challenge isn't checked as you go."],
    ["an unknown question", quiz(), "q9", "b", "Couldn't check your answer."],
    ["an option that doesn't exist", quiz(), "q1", "zz", "Choose an answer."],
    ["an incomplete match", quiz(), "q2", ["x=c1"], "Put every item on a category."],
    ["two items on one category when each takes one", quiz(), "q2", ["x=c1", "y=c1"], "Each category takes one item."],
  ])("refuses %s without counting a try", async (_label, challenge, questionId, answer, error) => {
    const db = setup(challenge);
    await expect(check(questionId, answer)).resolves.toEqual({ ok: false, error });
    expect(db.rpcCalls).toEqual([]);
  });

  it("refuses an answer from an outdated page", async () => {
    const db = setup();
    await expect(check("q1", "b", 1)).resolves.toMatchObject({ ok: false, stale: true });
    expect(db.rpcCalls).toEqual([]);
  });

  it("refuses a learner whose track can't see the challenge, and a draft for a non-tester", async () => {
    setup(quiz({ audiences: ["designer"] }));
    await expect(check("q1", "b")).resolves.toEqual({ ok: false, error: "This challenge isn't open for submissions." });
    setup(quiz({ status: "draft" }));
    await expect(check("q1", "b")).resolves.toEqual({ ok: false, error: "This challenge isn't open for submissions." });
  });
});

describe("the other ways in are closed for an instant quiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    getCurrentProfile.mockResolvedValue(profile());
  });

  it("submitChallenge can't hand in all the answers at once (that would skip the tries)", async () => {
    const db = setup();
    await expect(
      submitChallenge("check", { answers: { q1: "b", q2: ["x=c1", "y=c2"] }, imagePaths: [], figmaUrl: null, reflection: null }),
    ).resolves.toEqual({ ok: false, error: "This quiz checks each answer as you go. Reload the page." });
    expect(db.inserts).toEqual([]);
  });

  it("saveDraft doesn't write to the run's draft", async () => {
    setup();
    await expect(saveDraft("check", { version: 2, step: 1, answers: {}, imagePaths: [], figmaUrl: "", reflection: "" })).resolves.toEqual({
      ok: false,
      error: "This quiz saves your progress as you go.",
    });
  });
});
