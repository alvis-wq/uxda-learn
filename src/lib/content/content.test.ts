import path from "node:path";
import { describe, expect, it } from "vitest";
import { categorySchema, loadAndValidate } from "./index";
import { planSync, countChanges } from "./sync-plan";
import { deriveSummary, hashPublicContent, toCategoryRow, toChallengeRows } from "./transform";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures/content");

describe("content validation", () => {
  it("accepts the valid fixture", () => {
    const { content, errors } = loadAndValidate(path.join(FIXTURES, "valid"));
    expect(errors).toEqual([]);
    expect(content.categories.map((c) => c.slug)).toEqual(["basics", "strat-only", "designers"]);
    expect(content.challenges.map((c) => c.data.slug).sort()).toEqual([
      "motion-basics",
      "quick-quiz",
      "read-the-rules",
      "show-your-work",
    ]);
  });

  it("accepts the real /content directory", () => {
    const { errors } = loadAndValidate(path.resolve(__dirname, "../../../content"));
    expect(errors).toEqual([]);
  });

  describe("invalid fixture", () => {
    const { errors } = loadAndValidate(path.join(FIXTURES, "invalid"));
    const messagesFor = (file: string) => errors.filter((e) => e.file.includes(file)).map((e) => e.message);

    it("reports duplicate category slugs", () => {
      expect(messagesFor("categories.yaml")).toContain('duplicate category slug "basics"');
    });

    it("reports unknown categories", () => {
      expect(messagesFor("unknown-category")).toContain('unknown category "nope"');
    });

    it("reports points mismatches", () => {
      expect(messagesFor("points-mismatch").join("\n")).toMatch(/points mismatch: points is 10 .* = 3/);
    });

    it("reports duplicate question and rubric ids", () => {
      const msgs = messagesFor("duplicate-ids");
      expect(msgs).toContain('duplicate question id "q1"');
      expect(msgs).toContain('duplicate rubric id "r1"');
    });

    it("reports duplicate challenge slugs and filename mismatches", () => {
      expect(errors.some((e) => e.message === 'duplicate challenge slug "dup-slug"')).toBe(true);
      expect(messagesFor("wrong-filename").join("\n")).toMatch(/must match the filename/);
    });

    it("reports schema errors, including unknown keys", () => {
      const msgs = messagesFor("bad-schema").join("\n");
      expect(msgs).toMatch(/difficulty/);
      expect(msgs).toMatch(/surprise/);
    });

    it("reports answers that are not option ids", () => {
      expect(messagesFor("bad-answer").join("\n")).toMatch(/answer "z" is not an option id/);
    });

    it("rejects the old single `audience` key with a pointer to `audiences`", () => {
      expect(messagesFor("legacy-audience").join("\n")).toMatch(/`audience` was replaced by `audiences`/);
      expect(categorySchema.safeParse({ slug: "x", title: "X", audience: "all" }).success).toBe(false);
    });

    it("rejects `all` mixed with tracks", () => {
      expect(messagesFor("all-plus-track").join("\n")).toMatch(/"all" can't be combined with tracks/);
    });

    it("rejects challenge audiences wider than the category's", () => {
      expect(messagesFor("audience-wider")).toEqual(['audiences: Designer can\'t see category "strat-only"']);
    });

    it("fails when a challenge is required for a track that can't see it", () => {
      expect(messagesFor("required-invisible").join("\n")).toMatch(/required_for: Designer can't see this challenge/);
      // required_for: all = every track, so a strategist-only challenge can't be required for all.
      const all = messagesFor("required-all-narrow");
      expect(all).toHaveLength(4);
      expect(all.join("\n")).not.toMatch(/Strategist/);
    });

    it("rejects acknowledge challenges with points or questions", () => {
      const msgs = messagesFor("bad-ack");
      expect(msgs).toContain("acknowledge challenges are worth 0 points");
      expect(msgs).toContain("acknowledge challenges have no questions, submission, rubric or grader_notes");
    });

    it("still requires points and difficulty for scored challenges", () => {
      expect(messagesFor("missing-points")).toEqual(["difficulty: is required", "points: is required"]);
    });

    it("requires rubric and grader notes when review is needed", () => {
      const msgs = messagesFor("review-without-rubric");
      expect(msgs).toContain("challenges that need review must have a rubric");
      expect(msgs).toContain("challenges that need review must have grader_notes");
    });
  });
});

describe("transform", () => {
  const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
  const quiz = content.challenges.find((c) => c.data.slug === "quick-quiz")!;
  const review = content.challenges.find((c) => c.data.slug === "show-your-work")!;

  it("never puts answers or grader notes in the public challenge row", () => {
    for (const ch of [quiz, review]) {
      const { challenge } = toChallengeRows(ch, content.categories);
      const json = JSON.stringify(challenge);
      expect(json).not.toMatch(/"answer"/);
      expect(json).not.toMatch(/Secret notes/);
    }
  });

  it("puts answers and grader notes in the key row", () => {
    expect(toChallengeRows(quiz, content.categories).key.answer_key).toEqual({ q1: "b", q2: ["a", "c"] });
    expect(toChallengeRows(review, content.categories).key.grader_notes).toBe("Secret notes.");
  });

  it("derives a summary from the first paragraph, skipping headings", () => {
    expect(deriveSummary("## Goal\nLearn **things** [here](https://x.y).\n\nMore.")).toBe("Learn things here.");
    expect(deriveSummary("# Only a heading")).toBeNull();
  });

  it("inherits audiences from the category", () => {
    expect(toChallengeRows(review, content.categories).challenge.audiences).toEqual(["strategist"]);
  });

  it("normalises audiences / required_for to arrays", () => {
    const ack = content.challenges.find((c) => c.data.slug === "read-the-rules")!;
    const motion = content.challenges.find((c) => c.data.slug === "motion-basics")!;
    expect(toChallengeRows(ack, content.categories).challenge).toMatchObject({
      audiences: ["all"],
      required_for: ["all"],
      type: "acknowledge",
      points: 0,
      difficulty: 1,
      questions: [],
    });
    expect(toChallengeRows(motion, content.categories).challenge).toMatchObject({
      audiences: ["motion_designer"],
      required_for: ["motion_designer"],
    });
    expect(toChallengeRows(quiz, content.categories).challenge.required_for).toEqual([]);
  });

  it("content_hash ignores status, required_for and private fields", () => {
    const base = toChallengeRows(quiz, content.categories).challenge.content_hash;
    const drafted = { ...quiz, data: { ...quiz.data, status: "draft" as const } };
    const newNotes = { ...quiz, data: { ...quiz.data, grader_notes: "changed" } };
    const required = { ...quiz, data: { ...quiz.data, required_for: ["all" as const] } };
    expect(toChallengeRows(drafted, content.categories).challenge.content_hash).toBe(base);
    expect(toChallengeRows(newNotes, content.categories).challenge.content_hash).toBe(base);
    expect(toChallengeRows(required, content.categories).challenge.content_hash).toBe(base);
    const narrowed = { ...quiz, data: { ...quiz.data, audiences: ["designer" as const] } };
    expect(toChallengeRows(narrowed, content.categories).challenge.content_hash).not.toBe(base);
    const newBody = { ...quiz, body: quiz.body + "\nMore." };
    expect(toChallengeRows(newBody, content.categories).challenge.content_hash).not.toBe(base);
  });
});

describe("planSync", () => {
  const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
  const disk = {
    categories: content.categories.map(toCategoryRow),
    challenges: content.challenges.map((c) => toChallengeRows(c, content.categories)),
  };
  // A DB that already matches the disk exactly.
  const synced = () => ({
    categories: disk.categories.map((c) => ({ ...c })),
    // Full rows as the DB returns them (timestamps in Postgres' +00:00 form).
    challenges: disk.challenges.map(({ challenge }) => ({
      ...challenge,
      due_at: challenge.due_at?.replace(/\.000Z$/, "+00:00") ?? null,
      version: 3 as number,
      status: challenge.status as string,
      required_for: [...challenge.required_for] as string[],
    })),
    // jsonb returns keys in its own order; planSync must not treat that as a change.
    keys: disk.challenges.map(({ key }) => ({
      challenge_slug: key.challenge_slug,
      answer_key: Object.fromEntries(Object.entries(key.answer_key).reverse()),
      grader_notes: key.grader_notes,
    })),
  });

  it("creates everything on an empty DB with version 1", () => {
    const plan = planSync(disk, { categories: [], challenges: [], keys: [] });
    expect(plan.categoryUpserts).toHaveLength(3);
    expect(plan.challengeWrites.map((w) => [w.row.slug, w.action, w.row.version])).toEqual([
      ["motion-basics", "create", 1],
      ["quick-quiz", "create", 1],
      ["read-the-rules", "create", 1],
      ["show-your-work", "create", 1],
    ]);
  });

  it("reports 0 changes when the DB already matches", () => {
    expect(countChanges(planSync(disk, synced()))).toBe(0);
  });

  it("bumps the version when public content changes", () => {
    const db = synced();
    db.challenges[0] = { ...db.challenges[0], title: "Old title", content_hash: "old" };
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(1);
    expect(plan.challengeWrites[0].row.version).toBe(4);
  });

  it("refreshes a stale stored hash without bumping when the fields are unchanged", () => {
    // e.g. after the audience → audiences migration: same content, hash computed the old way.
    // read-the-rules has a due_at, which the DB returns as +00:00 rather than Z.
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "read-the-rules");
    db.challenges[i] = { ...db.challenges[i], content_hash: "hash-from-old-format" };
    const expected = disk.challenges.find((c) => c.challenge.slug === "read-the-rules")!.challenge.content_hash;
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(0);
    expect(plan.challengeMetaUpdates).toEqual([
      expect.objectContaining({ slug: "read-the-rules", content_hash: expected }),
    ]);
    expect(db.challenges[i].due_at).toMatch(/\+00:00$/);
    expect(hashPublicContent(db.challenges[i])).toBe(expected);
  });

  it("updates required_for without bumping the version", () => {
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "read-the-rules");
    db.challenges[i] = { ...db.challenges[i], required_for: [] };
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(0);
    expect(plan.challengeMetaUpdates).toEqual([
      expect.objectContaining({ slug: "read-the-rules", required_for: ["all"] }),
    ]);
  });

  it("updates a category whose audiences changed", () => {
    const db = synced();
    db.categories[2] = { ...db.categories[2], audiences: ["designer"] };
    expect(planSync(disk, db).categoryUpserts).toEqual([
      { row: expect.objectContaining({ slug: "designers", audiences: ["designer", "motion_designer"] }), action: "update" },
    ]);
  });

  it("bumps the version when only the answer key changes", () => {
    const db = synced();
    db.keys[0] = { ...db.keys[0], answer_key: { q1: "a", q2: ["a", "c"] } };
    expect(planSync(disk, db).challengeWrites[0]?.row.version).toBe(4);
  });

  it("updates status without bumping the version", () => {
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "quick-quiz");
    db.challenges[i] = { ...db.challenges[i], status: "draft" };
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(0);
    expect(plan.challengeMetaUpdates).toEqual([
      expect.objectContaining({ slug: "quick-quiz", status: "published", required_for: [] }),
    ]);
  });

  it("archives content removed from disk instead of deleting it", () => {
    const db = synced();
    db.challenges.push({ ...db.challenges[0], slug: "gone", content_hash: "x", version: 1, status: "published" });
    db.categories.push({ ...db.categories[0], slug: "old-cat" });
    const plan = planSync(disk, db);
    expect(plan.challengeArchives).toEqual(["gone"]);
    expect(plan.categoryArchives).toEqual(["old-cat"]);
  });

  it("does not re-archive already archived content", () => {
    const db = synced();
    db.challenges.push({ ...db.challenges[0], slug: "gone", content_hash: "x", version: 1, status: "archived" });
    db.categories.push({ ...db.categories[0], slug: "old-cat", archived: true });
    expect(countChanges(planSync(disk, db))).toBe(0);
  });
});
