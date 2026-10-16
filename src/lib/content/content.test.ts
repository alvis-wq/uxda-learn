import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categorySchema, challengeFrontmatterSchema, loadAndValidate, pathFileSchema } from "./index";
import { planSync, countChanges } from "./sync-plan";
import { contentWarnings, validateContent } from "./validate";
import { deriveSummary, hashPublicContent, NO_IMAGE_TUNING, toCategoryRow, toChallengeRows, toPathRow } from "./transform";

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

  describe("warnings: content only for tracks nobody can choose (account manager, marketing assistant)", () => {
    it("the real /content directory and the valid fixture have none", () => {
      expect(loadAndValidate(path.resolve(__dirname, "../../../content")).warnings).toEqual([]);
      expect(loadAndValidate(path.join(FIXTURES, "valid")).warnings).toEqual([]);
    });

    it("warns on a category, challenge, required_for or path aimed only at hidden tracks — without failing", () => {
      const { content } = loadAndValidate(path.join(FIXTURES, "paths"));
      content.categories[0].audiences = ["account_manager"];
      content.challenges[0].data.audiences = ["assistant"];
      content.challenges[1].data.required_for = ["account_manager", "assistant"];
      content.paths[0].data.audiences = ["assistant"];
      const messages = contentWarnings(content).map((w) => `${w.file}: ${w.message}`);
      expect(messages).toEqual([
        expect.stringMatching(/^categories\.yaml: category ".+" is only for Account Manager, which nobody can choose/),
        `${content.challenges[0].file}: audiences: only Marketing Assistant, which nobody can choose any more`,
        `${content.challenges[1].file}: required_for: only Account Manager, Marketing Assistant, which nobody can choose any more`,
        `${content.paths[0].file}: audiences: only Marketing Assistant, which nobody can choose any more`,
      ]);
    });

    it("doesn't warn when a selectable track or `all` is in the list too", () => {
      const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
      content.challenges[0].data.audiences = ["assistant", "management"];
      content.challenges[1].data.audiences = ["all"];
      expect(contentWarnings(content)).toEqual([]);
    });
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
      expect(all).toHaveLength(5); // one per track that can't see it: designer, motion designer, AM, assistant, management
      expect(all.join("\n")).not.toMatch(/Strategist/);
    });

    it("rejects status: published while the content still has TODO placeholders", () => {
      expect(messagesFor("published-placeholder")).toEqual([
        "status: published, but the content still has placeholders: TODO_FIGMA_URL (brief, questions) — keep it draft until they're filled in",
      ]);
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

describe("learning paths", () => {
  it("accepts a valid path and its milestones", () => {
    const { content, errors } = loadAndValidate(path.join(FIXTURES, "paths"));
    expect(errors).toEqual([]);
    expect(content.paths).toHaveLength(1);
    expect(content.paths[0].data).toMatchObject({
      slug: "two-steps",
      sequential: true, // the default
      milestones: ["step-one", "step-two"],
      before_you_start: "You need **Figma** open.",
      before_you_submit: ["Frames are 360 px wide."],
      requires: [], // the default
      status: "draft",
    });
  });

  it("checks a path's card image like a challenge's: a plain file name that exists in public/challenges", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "path-images-"));
    writeFileSync(path.join(dir, "exists.png"), "");
    const withImage = (image?: string) => {
      const { content } = loadAndValidate(path.join(FIXTURES, "paths"));
      content.paths[0].data.image = image;
      return validateContent(content, dir).map((e) => `${e.file}: ${e.message}`);
    };
    expect(withImage("exists.png")).toEqual([]);
    expect(withImage()).toEqual([]);
    expect(withImage("nope.png")).toEqual(['paths/two-steps.yaml: image: "nope.png" not found in public/challenges/']);

    const { content } = loadAndValidate(path.join(FIXTURES, "paths"));
    const file = content.paths[0].data;
    expect(pathFileSchema.safeParse({ ...file, image: "dir/a.png" }).success).toBe(false);
    expect(toPathRow({ ...file, image: "exists.png" }, content.categories).row.image).toBe("exists.png");
    expect(toPathRow({ ...file, image: undefined }, content.categories).row.image).toBeNull();
  });

  describe("required_for and due_at (starting values, like status)", () => {
    const withSettings = (required_for: ("all" | "strategist" | "designer")[] | undefined, due_at?: string) => {
      const { content } = loadAndValidate(path.join(FIXTURES, "paths"));
      content.paths[0].data.required_for = required_for;
      content.paths[0].data.due_at = due_at;
      return validateContent(content).map((e) => e.message);
    };

    it("accepts tracks that can see the path, and a due date", () => {
      expect(withSettings(["strategist"], "2026-12-01T17:00:00Z")).toEqual([]);
      expect(withSettings(undefined)).toEqual([]);
    });

    it("rejects a track that can't see the path (\"all\" included)", () => {
      expect(withSettings(["designer"])).toContain("required_for: Designer can't see this path (check audiences of the path and its category)");
      expect(withSettings(["all"])).toContain("required_for: Designer can't see this path (check audiences of the path and its category)");
    });

    it("parses them from the file", () => {
      const base = { slug: "p", title: "P", category: "c", summary: "S", milestones: ["a", "b"] };
      expect(pathFileSchema.safeParse({ ...base, required_for: ["designer"], due_at: "2026-12-01T17:00:00Z" }).success).toBe(true);
      expect(pathFileSchema.safeParse({ ...base, due_at: "next week" }).success).toBe(false);
      expect(pathFileSchema.safeParse({ ...base, required_for: ["all", "designer"] }).success).toBe(false);
    });
  });

  const { errors } = loadAndValidate(path.join(FIXTURES, "paths-invalid"));
  const messagesFor = (file: string) => errors.filter((e) => e.file === file).map((e) => e.message);

  it("checks the path file itself", () => {
    const msgs = messagesFor("paths/misnamed.yaml");
    expect(msgs).toContain('slug "named-else" must match the filename (paths/named-else.yaml)');
    expect(msgs).toContain('unknown category "nope"');
  });

  it("checks every listed milestone", () => {
    const msgs = messagesFor("paths/bad-links.yaml");
    expect(msgs).toContain('milestones: "twice" is listed twice');
    expect(msgs).toContain('milestones: no challenge "missing-one"');
    expect(msgs).toContain('milestones: "no-back-link" must say `path: bad-links`');
    expect(msgs).toContain('milestones: "draft-step" must say `path: bad-links` (it says path: second)');
    expect(msgs).toContain('milestones: "other-category" is in category "basics", the path in "strat-only"');
    expect(msgs).toContain('milestones: "other-category" must have the same audiences as the path');
    expect(msgs).toContain('status: published, but milestone "no-back-link" is draft');
    expect(msgs).not.toContain('status: published, but milestone "twice" is draft');
  });

  it("checks the paths a path requires", () => {
    const msgs = messagesFor("paths/bad-links.yaml");
    expect(msgs).toContain('requires: no path "ghost-path" (content/paths/ghost-path.yaml)');
    expect(msgs).toContain("requires: a path can't require itself");
    expect(msgs).toContain('requires: "second" is listed twice');
    expect(msgs).toContain("requires: goes round in a loop (bad-links → second → bad-links), so none of these paths could ever unlock");
    expect(messagesFor("paths/second.yaml")).toContain(
      "requires: goes round in a loop (second → bad-links → second), so none of these paths could ever unlock",
    );
  });

  it("checks challenges that say `path:`", () => {
    expect(messagesFor("challenges/orphan.md")).toEqual(['path: no path "ghost" (content/paths/ghost.yaml)']);
    expect(messagesFor("challenges/unlisted.md")).toEqual([
      'path: "bad-links" doesn\'t list this challenge in its milestones',
      "required_for: a path milestone can't be required on its own",
      "due_at: a path milestone can't have its own due date",
    ]);
    expect(messagesFor("challenges/in-two-paths.md")).toEqual(["is a milestone of more than one path (bad-links, second)"]);
    expect(messagesFor("challenges/ack-milestone.md")).toEqual(["a path milestone can't be an acknowledge challenge"]);
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
      type: "acknowledge",
      points: 0,
      difficulty: 1,
      questions: [],
    });
    expect(toChallengeRows(ack, content.categories).settings.required_for).toEqual(["all"]);
    expect(toChallengeRows(motion, content.categories).challenge.audiences).toEqual(["motion_designer"]);
    expect(toChallengeRows(motion, content.categories).settings.required_for).toEqual(["motion_designer"]);
    expect(toChallengeRows(quiz, content.categories).settings.required_for).toEqual([]);
  });

  it("keeps the admin-owned settings out of the public content row", () => {
    const ack = content.challenges.find((c) => c.data.slug === "read-the-rules")!;
    const { challenge, settings } = toChallengeRows(ack, content.categories);
    expect(challenge).not.toHaveProperty("status");
    expect(challenge).not.toHaveProperty("required_for");
    expect(challenge).not.toHaveProperty("due_at");
    expect(settings).toEqual({ status: "published", required_for: ["all"], due_at: "2026-10-20T09:00:00.000Z" });
  });

  it("content_hash ignores status, required_for, due_at and private fields", () => {
    const base = toChallengeRows(quiz, content.categories).challenge.content_hash;
    const drafted = { ...quiz, data: { ...quiz.data, status: "draft" as const } };
    const newNotes = { ...quiz, data: { ...quiz.data, grader_notes: "changed" } };
    const required = { ...quiz, data: { ...quiz.data, required_for: ["all" as const] } };
    expect(toChallengeRows(drafted, content.categories).challenge.content_hash).toBe(base);
    expect(toChallengeRows(newNotes, content.categories).challenge.content_hash).toBe(base);
    expect(toChallengeRows(required, content.categories).challenge.content_hash).toBe(base);
    const due = { ...quiz, data: { ...quiz.data, due_at: "2027-01-01T00:00:00Z" } };
    expect(toChallengeRows(due, content.categories).challenge.content_hash).toBe(base);
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
    challenges: disk.challenges.map(({ challenge, settings }) => ({
      ...challenge,
      due_at: settings.due_at?.replace(/\.000Z$/, "+00:00") ?? null,
      version: 3 as number,
      status: settings.status as string,
      required_for: [...settings.required_for] as string[],
    })),
    // jsonb returns keys in its own order; planSync must not treat that as a change.
    keys: disk.challenges.map(({ key }) => ({
      challenge_slug: key.challenge_slug,
      answer_key: Object.fromEntries(Object.entries(key.answer_key).reverse()),
      grader_notes: key.grader_notes,
    })),
  });

  it("creates everything on an empty DB with version 1, taking settings from the file", () => {
    const plan = planSync(disk, { categories: [], challenges: [], keys: [] });
    expect(plan.categoryUpserts).toHaveLength(3);
    expect(plan.challengeWrites.map((w) => [w.row.slug, w.action, w.row.version])).toEqual([
      ["motion-basics", "create", 1],
      ["quick-quiz", "create", 1],
      ["read-the-rules", "create", 1],
      ["show-your-work", "create", 1],
    ]);
    const rules = plan.challengeWrites.find((w) => w.row.slug === "read-the-rules")!;
    expect(rules.action === "create" && rules.settings).toEqual({
      status: "published",
      required_for: ["all"],
      due_at: "2026-10-20T09:00:00.000Z",
    });
    expect(plan.settingsDrift).toEqual([]);
  });

  it("reports 0 changes when the DB already matches", () => {
    const plan = planSync(disk, synced());
    expect(countChanges(plan)).toBe(0);
    expect(plan.settingsDrift).toEqual([]);
  });

  it("bumps the version when public content changes, without touching settings", () => {
    const db = synced();
    db.challenges[0] = { ...db.challenges[0], title: "Old title", content_hash: "old", status: "draft" };
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(1);
    const [w] = plan.challengeWrites;
    expect(w.action).toBe("update");
    expect(w.row.version).toBe(4);
    expect(w).not.toHaveProperty("settings");
    for (const field of ["status", "required_for", "due_at"]) expect(w.row).not.toHaveProperty(field);
  });

  it("refreshes a stale stored hash without bumping when the fields are unchanged", () => {
    // e.g. after due_at moved out of the hash: same content, hash computed the old way.
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "read-the-rules");
    db.challenges[i] = { ...db.challenges[i], content_hash: "hash-from-old-format" };
    const expected = disk.challenges.find((c) => c.challenge.slug === "read-the-rules")!.challenge.content_hash;
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toHaveLength(0);
    expect(plan.challengeHashRefreshes).toEqual([{ slug: "read-the-rules", content_hash: expected }]);
    expect(hashPublicContent(db.challenges[i])).toBe(expected);
  });

  it("never writes status, required_for or due_at for an existing challenge — the DB wins", () => {
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "read-the-rules");
    // An admin changed all three in the panel; the file still has the original values.
    db.challenges[i] = { ...db.challenges[i], status: "draft", required_for: [], due_at: "2027-02-01T09:00:00+00:00" };
    const plan = planSync(disk, db);
    expect(countChanges(plan)).toBe(0);
    expect(plan.settingsDrift).toEqual([
      { slug: "read-the-rules", field: "status", file: "published", db: "draft" },
      { slug: "read-the-rules", field: "required_for", file: "[all]", db: "optional" },
      { slug: "read-the-rules", field: "due_at", file: "2026-10-20T09:00:00.000Z", db: "2027-02-01T09:00:00.000Z" },
    ]);
  });

  it("does not report drift for the same due date in a different timestamp format", () => {
    const db = synced();
    const i = db.challenges.findIndex((c) => c.slug === "read-the-rules");
    expect(db.challenges[i].due_at).toMatch(/\+00:00$/);
    expect(planSync(disk, db).settingsDrift).toEqual([]);
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

describe("challenge tip", () => {
  const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
  const frontmatter = (tip?: unknown) => ({ ...content.challenges[0].data, tip });

  it("is optional, trimmed markdown of at most 1000 characters", () => {
    expect(challengeFrontmatterSchema.safeParse(frontmatter()).success).toBe(true);
    const ok = challengeFrontmatterSchema.safeParse(frontmatter("  Mind the **rubric**.  "));
    expect(ok.success && ok.data.tip).toBe("Mind the **rubric**.");
    expect(challengeFrontmatterSchema.safeParse(frontmatter("x".repeat(1000))).success).toBe(true);
    expect(challengeFrontmatterSchema.safeParse(frontmatter("x".repeat(1001))).success).toBe(false);
    expect(challengeFrontmatterSchema.safeParse(frontmatter("   ")).success).toBe(false);
    expect(challengeFrontmatterSchema.safeParse(frontmatter(5)).success).toBe(false);
  });

  it("can't be left with a TODO placeholder in a challenge that says status: published", () => {
    const withTip = loadAndValidate(path.join(FIXTURES, "valid")).content;
    withTip.challenges[0].data.status = "published";
    withTip.challenges[0].data.tip = "Open TODO_LINK first";
    const messages = validateContent(withTip).map((e) => e.message);
    expect(messages.some((m) => m.includes("TODO_LINK") && m.includes("tip"))).toBe(true);
  });
});

describe("waiting_minutes", () => {
  const withTimes = (estimated: number | undefined, waiting: number | undefined) => {
    const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
    content.challenges[0].data.estimated_minutes = estimated;
    content.challenges[0].data.waiting_minutes = waiting;
    return content;
  };
  const messages = (estimated: number | undefined, waiting: number | undefined) =>
    validateContent(withTimes(estimated, waiting)).map((e) => e.message);

  it("is optional, and a whole number of 0 or more", () => {
    const fm = { slug: "c", title: "C", category: "basics", type: "quiz" };
    expect(challengeFrontmatterSchema.safeParse(fm).success).toBe(true);
    expect(challengeFrontmatterSchema.safeParse({ ...fm, estimated_minutes: 20, waiting_minutes: 0 }).success).toBe(true);
    expect(challengeFrontmatterSchema.safeParse({ ...fm, estimated_minutes: 20, waiting_minutes: -1 }).success).toBe(false);
    expect(challengeFrontmatterSchema.safeParse({ ...fm, estimated_minutes: 20, waiting_minutes: 2.5 }).success).toBe(false);
  });

  it("can be up to estimated_minutes", () => {
    expect(messages(20, 10)).toEqual([]);
    expect(messages(20, 20)).toEqual([]);
    expect(messages(20, undefined)).toEqual([]);
  });

  it("can't be more than estimated_minutes", () => {
    expect(messages(20, 25)).toContain("waiting_minutes: 25 is more than estimated_minutes (20); waiting is part of the total");
  });

  it("needs estimated_minutes", () => {
    expect(messages(undefined, 5)).toContain("waiting_minutes: needs estimated_minutes (the total time) too");
  });

  it("is in content_hash only when set, so challenges without it keep their hash", () => {
    const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
    const quiz = content.challenges[0];
    const timed = { ...quiz, data: { ...quiz.data, estimated_minutes: 20 } };
    const row = (waiting: number | undefined) =>
      toChallengeRows({ ...timed, data: { ...timed.data, waiting_minutes: waiting } }, content.categories).challenge;
    const { waiting_minutes, ...withoutColumn } = row(undefined);
    expect(waiting_minutes).toBeNull();
    // The hash a row had before the column existed.
    expect(row(undefined).content_hash).toBe(hashPublicContent(withoutColumn as unknown as Parameters<typeof hashPublicContent>[0]));
    expect(row(10).waiting_minutes).toBe(10);
    expect(row(10).content_hash).not.toBe(row(undefined).content_hash);
    expect(row(10).content_hash).not.toBe(row(5).content_hash);
  });
});

describe("card images", () => {
  const base = { slug: "c", title: "C", audiences: "all" };

  it("accepts a plain image file name on a category and rejects anything else", () => {
    for (const ok of ["a.webp", "red-flags.png", "x_1.2.jpeg", "photo.avif"]) {
      expect(categorySchema.safeParse({ ...base, image: ok }).success, ok).toBe(true);
    }
    for (const bad of ["../a.png", "dir/a.png", "/a.png", "A.PNG", "a.gif", "a", "a.svg", ""]) {
      expect(categorySchema.safeParse({ ...base, image: bad }).success, bad).toBe(false);
    }
    expect(categorySchema.safeParse(base).success).toBe(true); // optional
  });

  describe("validation", () => {
    const withImages = (challengeImage?: string, categoryImage?: string) => {
      const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
      content.challenges[0].data.image = challengeImage;
      content.categories[0].image = categoryImage;
      return content;
    };
    const dir = mkdtempSync(path.join(tmpdir(), "card-images-"));
    writeFileSync(path.join(dir, "exists.webp"), "");

    it("accepts images that exist in public/challenges", () => {
      expect(validateContent(withImages("exists.webp", "exists.webp"), dir)).toEqual([]);
    });

    it("rejects a challenge or category image whose file is missing", () => {
      const messages = validateContent(withImages("nope.webp", "nada.png"), dir).map((e) => `${e.file}: ${e.message}`);
      expect(messages.some((m) => m.includes("image") && m.includes("nope.webp") && m.includes("public/challenges"))).toBe(true);
      expect(messages.some((m) => m.startsWith("categories.yaml") && m.includes("nada.png"))).toBe(true);
    });

    it("needs no image at all", () => {
      expect(validateContent(withImages(), dir)).toEqual([]);
    });
  });

  describe("sync", () => {
    const { content } = loadAndValidate(path.join(FIXTURES, "valid"));
    const rowsFor = (image?: string, tip?: string) => ({
      categories: content.categories.map(toCategoryRow),
      challenges: content.challenges.map((c, i) => toChallengeRows(i === 0 ? { ...c, data: { ...c.data, image, tip } } : c, content.categories)),
    });
    const dbFrom = (disk: ReturnType<typeof rowsFor>) => ({
      categories: disk.categories.map((c) => ({ ...c })),
      challenges: disk.challenges.map(({ challenge, settings }) => ({
        ...challenge,
        due_at: settings.due_at?.replace(/\.000Z$/, "+00:00") ?? null,
        version: 3 as number,
        status: settings.status as string,
        required_for: [...settings.required_for] as string[],
      })),
      keys: disk.challenges.map(({ key }) => ({ challenge_slug: key.challenge_slug, answer_key: key.answer_key, grader_notes: key.grader_notes })),
    });

    it("keeps the image out of content_hash", () => {
      const a = rowsFor().challenges[0].challenge;
      const b = rowsFor("hero.webp").challenges[0].challenge;
      expect(b.image).toBe("hero.webp");
      expect(b.content_hash).toBe(a.content_hash);
    });

    it("a changed challenge image alone is its own write: no version bump, no hash refresh", () => {
      const plan = planSync(rowsFor("new.webp"), dbFrom(rowsFor("old.webp")));
      expect(plan.challengeWrites).toEqual([]);
      expect(plan.challengeHashRefreshes).toEqual([]);
      expect(plan.challengeDisplayUpdates).toEqual([{ slug: content.challenges[0].data.slug, image: "new.webp", tip: null, help_link: null, path_slug: null, ...NO_IMAGE_TUNING }]);
      expect(countChanges(plan)).toBe(1);
    });

    it("adding and removing an image are both detected", () => {
      expect(planSync(rowsFor("a.webp"), dbFrom(rowsFor())).challengeDisplayUpdates).toHaveLength(1);
      expect(planSync(rowsFor(), dbFrom(rowsFor("a.webp"))).challengeDisplayUpdates).toEqual([
        { slug: content.challenges[0].data.slug, image: null, tip: null, help_link: null, path_slug: null, ...NO_IMAGE_TUNING },
      ]);
    });

    it("keeps the tip out of content_hash", () => {
      const a = rowsFor().challenges[0].challenge;
      const b = rowsFor(undefined, "Mind the **rubric**.").challenges[0].challenge;
      expect(b.tip).toBe("Mind the **rubric**.");
      expect(a.tip).toBeNull();
      expect(b.content_hash).toBe(a.content_hash);
    });

    it("a changed tip alone is a version-neutral display write; adding and removing are both detected", () => {
      const slug = content.challenges[0].data.slug;
      const plan = planSync(rowsFor(undefined, "new"), dbFrom(rowsFor(undefined, "old")));
      expect(plan.challengeWrites).toEqual([]);
      expect(plan.challengeHashRefreshes).toEqual([]);
      expect(plan.challengeDisplayUpdates).toEqual([{ slug, image: null, tip: "new", help_link: null, path_slug: null, ...NO_IMAGE_TUNING }]);
      expect(planSync(rowsFor(undefined, "t"), dbFrom(rowsFor())).challengeDisplayUpdates).toHaveLength(1);
      expect(planSync(rowsFor(), dbFrom(rowsFor(undefined, "t"))).challengeDisplayUpdates).toEqual([{ slug, image: null, tip: null, help_link: null, path_slug: null, ...NO_IMAGE_TUNING }]);
      expect(countChanges(planSync(rowsFor(undefined, "t"), dbFrom(rowsFor(undefined, "t"))))).toBe(0);
    });

    it("an older database without the tip column (undefined) reads as no tip", () => {
      const db = dbFrom(rowsFor());
      for (const c of db.challenges) delete (c as { tip?: unknown }).tip;
      expect(countChanges(planSync(rowsFor(), db))).toBe(0);
    });

    it("an unchanged image changes nothing", () => {
      expect(countChanges(planSync(rowsFor("a.webp"), dbFrom(rowsFor("a.webp"))))).toBe(0);
    });

    it("a content change that also changes the image is one write, carrying the image", () => {
      const db = dbFrom(rowsFor("old.webp"));
      const i = db.challenges.findIndex((c) => c.slug === content.challenges[0].data.slug);
      db.challenges[i] = { ...db.challenges[i], title: "Old title", content_hash: "old" };
      const plan = planSync(rowsFor("new.webp"), db);
      expect(plan.challengeWrites).toHaveLength(1);
      expect(plan.challengeWrites[0].row.image).toBe("new.webp");
      expect(plan.challengeDisplayUpdates).toEqual([]);
    });

    describe("illustration tuning (image_scale, image_offset_x, image_offset_y)", () => {
      const slug = content.challenges[0].data.slug;
      const tuned = (t: { image_scale?: number; image_offset_x?: number; image_offset_y?: number }, image = "a.webp") => ({
        categories: content.categories.map(toCategoryRow),
        challenges: content.challenges.map((c, i) => toChallengeRows(i === 0 ? { ...c, data: { ...c.data, image, ...t } } : c, content.categories)),
      });

      it("defaults to no tuning and stays out of content_hash", () => {
        const plain = tuned({}).challenges[0].challenge;
        const moved = tuned({ image_scale: 1.2, image_offset_x: -10, image_offset_y: 5 }).challenges[0].challenge;
        expect(plain).toMatchObject(NO_IMAGE_TUNING);
        expect(moved).toMatchObject({ image_scale: 1.2, image_offset_x: -10, image_offset_y: 5 });
        expect(moved.content_hash).toBe(plain.content_hash);
      });

      it("a changed tuning alone is a version-neutral display write, carrying it", () => {
        const plan = planSync(tuned({ image_offset_y: 8 }), dbFrom(tuned({})));
        expect(plan.challengeWrites).toEqual([]);
        expect(plan.challengeDisplayUpdates).toEqual([{ slug, image: "a.webp", tip: null, help_link: null, path_slug: null, ...NO_IMAGE_TUNING, image_offset_y: 8 }]);
        expect(countChanges(planSync(tuned({ image_scale: 1.5 }), dbFrom(tuned({ image_scale: 1.5 }))))).toBe(0);
      });

      it("reads numeric columns returned as strings, and an older database without the columns as untuned", () => {
        const db = dbFrom(tuned({ image_scale: 1.5 }));
        db.challenges[0] = { ...db.challenges[0], image_scale: "1.5" as unknown as number };
        expect(countChanges(planSync(tuned({ image_scale: 1.5 }), db))).toBe(0);
        const old = dbFrom(tuned({}));
        for (const c of old.challenges) for (const f of ["image_scale", "image_offset_x", "image_offset_y"]) delete (c as Record<string, unknown>)[f];
        expect(countChanges(planSync(tuned({}), old))).toBe(0);
      });

      it("schema: scale 0.5–2, offsets -50–50 (% of the illustration)", () => {
        const base = content.challenges[0].data;
        const ok = (t: object) => challengeFrontmatterSchema.safeParse({ ...base, image: "a.webp", ...t }).success;
        expect(ok({ image_scale: 0.5, image_offset_x: -50, image_offset_y: 50 })).toBe(true);
        expect(ok({ image_scale: 2.01 })).toBe(false);
        expect(ok({ image_scale: 0.4 })).toBe(false);
        expect(ok({ image_offset_x: 51 })).toBe(false);
        expect(ok({ image_offset_y: -51 })).toBe(false);
      });

      it("validation: tuning needs the file's own image", () => {
        const dir = mkdtempSync(path.join(tmpdir(), "tuning-"));
        writeFileSync(path.join(dir, "a.webp"), "");
        const { content: c } = loadAndValidate(path.join(FIXTURES, "valid"));
        c.challenges[0].data.image_scale = 1.2;
        const file = c.challenges[0].file;
        expect(validateContent(c, dir).map((e) => `${e.file}: ${e.message}`)).toContain(
          `${file}: image_scale: tunes this file's own illustration, so it needs \`image\` here too`,
        );
        c.challenges[0].data.image = "a.webp";
        expect(validateContent(c, dir)).toEqual([]);
      });
    });

    it("a category image change updates the category", () => {
      const disk = rowsFor();
      const db = dbFrom(disk);
      disk.categories[0] = { ...disk.categories[0], image: "cat.webp" };
      const plan = planSync(disk, db);
      expect(plan.categoryUpserts).toEqual([{ row: disk.categories[0], action: "update" }]);
    });
  });
});

describe("planSync for learning paths", () => {
  const { content } = loadAndValidate(path.join(FIXTURES, "paths"));
  const disk = {
    categories: content.categories.map(toCategoryRow),
    challenges: content.challenges.map((c) => toChallengeRows(c, content.categories)),
    paths: content.paths.map((p) => toPathRow(p.data, content.categories)),
  };
  const synced = () => ({
    categories: disk.categories.map((c) => ({ ...c })),
    challenges: disk.challenges.map(({ challenge, settings }) => ({
      ...challenge,
      version: 1,
      status: settings.status as string,
      required_for: [...settings.required_for] as string[],
      due_at: settings.due_at,
    })),
    keys: disk.challenges.map(({ key }) => ({ ...key })),
    paths: disk.paths.map(({ row, settings }) => ({
      ...row,
      status: settings.status as string,
      required_for: [...settings.required_for] as string[],
      due_at: settings.due_at,
    })),
  });

  it("creates the path with the file's status and its milestones with path_slug", () => {
    const plan = planSync(disk, { categories: [], challenges: [], keys: [], paths: [] });
    expect(plan.pathWrites).toEqual([
      { action: "create", row: disk.paths[0].row, settings: { status: "draft", required_for: [], due_at: null } },
    ]);
    expect(disk.paths[0].row).toMatchObject({ audiences: ["strategist"], milestones: ["step-one", "step-two"], sequential: true });
    expect(plan.challengeWrites.map((w) => w.row.path_slug)).toEqual(["two-steps", "two-steps"]);
  });

  it("does nothing when the DB matches", () => {
    expect(countChanges(planSync(disk, synced()))).toBe(0);
  });

  it("updates path content but never its status (reported as drift)", () => {
    const db = synced();
    db.paths[0] = { ...db.paths[0], title: "Old", status: "published" };
    const plan = planSync(disk, db);
    expect(plan.pathWrites).toEqual([{ action: "update", row: disk.paths[0].row }]);
    expect(plan.pathWrites[0]).not.toHaveProperty("status");
    expect(plan.pathSettingsDrift).toEqual([{ slug: "two-steps", field: "status", file: "draft", db: "published" }]);
  });

  it("creates a path with the file's required_for and due_at, then never writes them (reported as drift)", () => {
    const withSettings = {
      ...disk,
      paths: disk.paths.map((p) => ({ ...p, settings: { ...p.settings, required_for: ["strategist" as const], due_at: "2026-12-01T17:00:00.000Z" } })),
    };
    const created = planSync(withSettings, { categories: [], challenges: [], keys: [], paths: [] });
    expect(created.pathWrites[0]).toMatchObject({ action: "create", settings: { required_for: ["strategist"], due_at: "2026-12-01T17:00:00.000Z" } });

    const db = synced(); // the panel made it optional with no due date
    const plan = planSync(withSettings, db);
    expect(plan.pathWrites).toEqual([]);
    expect(countChanges(plan)).toBe(0);
    expect(plan.pathSettingsDrift).toEqual([
      { slug: "two-steps", field: "required_for", file: "[strategist]", db: "optional" },
      { slug: "two-steps", field: "due_at", file: "2026-12-01T17:00:00.000Z", db: "none" },
    ]);
  });

  it("an older database without the path settings columns reads as optional with no due date", () => {
    const db = synced();
    for (const p of db.paths) {
      delete (p as { required_for?: unknown }).required_for;
      delete (p as { due_at?: unknown }).due_at;
    }
    expect(planSync(disk, db).pathSettingsDrift).toEqual([]);
  });

  it("writes a changed path_slug without bumping the version, and keeps it out of the content hash", () => {
    const db = synced();
    db.challenges[0] = { ...db.challenges[0], path_slug: null };
    const plan = planSync(disk, db);
    expect(plan.challengeWrites).toEqual([]);
    expect(plan.challengeDisplayUpdates).toEqual([{ slug: "step-one", image: null, tip: null, help_link: null, path_slug: "two-steps", ...NO_IMAGE_TUNING }]);
    const ch = content.challenges[0];
    const moved = { ...ch, data: { ...ch.data, path: undefined } };
    expect(toChallengeRows(moved, content.categories).challenge.content_hash).toBe(disk.challenges[0].challenge.content_hash);
  });

  it("writes a changed 'Before you start' box as a path content update", () => {
    const db = synced();
    db.paths[0] = { ...db.paths[0], before_you_start: null };
    expect(planSync(disk, db).pathWrites).toEqual([{ action: "update", row: disk.paths[0].row }]);
  });

  it("writes a changed card image as a path content update", () => {
    const db = synced();
    db.paths[0] = { ...db.paths[0], image: "old.png" };
    expect(planSync(disk, db).pathWrites).toEqual([{ action: "update", row: disk.paths[0].row }]);
  });

  it("writes a changed illustration tuning as a path content update", () => {
    const db = synced();
    db.paths[0] = { ...db.paths[0], image_scale: 1.3 };
    expect(planSync(disk, db).pathWrites).toEqual([{ action: "update", row: disk.paths[0].row }]);
    expect(disk.paths[0].row).toMatchObject(NO_IMAGE_TUNING);
    const file = { ...content.paths[0].data, image: "p.png", image_offset_x: 12 };
    expect(toPathRow(file, content.categories).row).toMatchObject({ image_scale: 1, image_offset_x: 12, image_offset_y: 0 });
  });

  it("writes a changed `requires` as a path content update", () => {
    const db = synced();
    db.paths[0] = { ...db.paths[0], requires: ["earlier"] };
    expect(planSync(disk, db).pathWrites).toEqual([{ action: "update", row: disk.paths[0].row }]);
  });

  it("archives a path whose file is gone", () => {
    const db = synced();
    db.paths.push({ ...db.paths[0], slug: "old-path", status: "published" });
    expect(planSync(disk, db).pathArchives).toEqual(["old-path"]);
  });
});
