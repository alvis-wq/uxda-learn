import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndValidate } from "./index";
import { planSync, countChanges } from "./sync-plan";
import { deriveSummary, toCategoryRow, toChallengeRows } from "./transform";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures/content");

describe("content validation", () => {
  it("accepts the valid fixture", () => {
    const { content, errors } = loadAndValidate(path.join(FIXTURES, "valid"));
    expect(errors).toEqual([]);
    expect(content.categories.map((c) => c.slug)).toEqual(["basics", "strat-only"]);
    expect(content.challenges.map((c) => c.data.slug).sort()).toEqual(["quick-quiz", "show-your-work"]);
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

  it("inherits audience from the category", () => {
    expect(toChallengeRows(review, content.categories).challenge.audience).toBe("strategist");
  });

  it("content_hash ignores status and private fields", () => {
    const base = toChallengeRows(quiz, content.categories).challenge.content_hash;
    const drafted = { ...quiz, data: { ...quiz.data, status: "draft" as const } };
    const newNotes = { ...quiz, data: { ...quiz.data, grader_notes: "changed" } };
    expect(toChallengeRows(drafted, content.categories).challenge.content_hash).toBe(base);
    expect(toChallengeRows(newNotes, content.categories).challenge.content_hash).toBe(base);
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
    challenges: disk.challenges.map(({ challenge }) => ({
      slug: challenge.slug, content_hash: challenge.content_hash, version: 3, status: challenge.status,
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
    expect(plan.categoryUpserts).toHaveLength(2);
    expect(plan.challengeWrites.map((w) => [w.row.slug, w.action, w.row.version])).toEqual([
      ["quick-quiz", "create", 1],
      ["show-your-work", "create", 1],
    ]);
  });

  it("reports 0 changes when the DB already matches", () => {
    expect(countChanges(planSync(disk, synced()))).toBe(0);
  });

  it("bumps the version when public content changes", () => {
    const db = synced();
    db.challenges[0].content_hash = "old";
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(1);
    expect(plan.challengeWrites[0].row.version).toBe(4);
  });

  it("bumps the version when only the answer key changes", () => {
    const db = synced();
    db.keys[0] = { ...db.keys[0], answer_key: { q1: "a", q2: ["a", "c"] } };
    expect(planSync(disk, db).challengeWrites[0]?.row.version).toBe(4);
  });

  it("updates status without bumping the version", () => {
    const db = synced();
    db.challenges[0].status = "draft";
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(0);
    expect(plan.challengeStatusUpdates).toEqual([{ slug: "quick-quiz", status: "published" }]);
  });

  it("archives content removed from disk instead of deleting it", () => {
    const db = synced();
    db.challenges.push({ slug: "gone", content_hash: "x", version: 1, status: "published" });
    db.categories.push({ ...db.categories[0], slug: "old-cat" });
    const plan = planSync(disk, db);
    expect(plan.challengeArchives).toEqual(["gone"]);
    expect(plan.categoryArchives).toEqual(["old-cat"]);
  });

  it("does not re-archive already archived content", () => {
    const db = synced();
    db.challenges.push({ slug: "gone", content_hash: "x", version: 1, status: "archived" });
    db.categories.push({ ...db.categories[0], slug: "old-cat", archived: true });
    expect(countChanges(planSync(disk, db))).toBe(0);
  });
});
