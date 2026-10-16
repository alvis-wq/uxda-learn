import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndValidate } from "./index";
import { planSync } from "./sync-plan";
import { hashPublicContent, toChallengeRows } from "./transform";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures/content");

describe("match questions and instant feedback in content", () => {
  const { content, errors } = loadAndValidate(path.join(FIXTURES, "match"));
  const ch = content.challenges[0];
  const rows = () => toChallengeRows(ch, content.categories);

  it("accepts valid match questions on an instant quiz", () => {
    expect(errors).toEqual([]);
    expect(ch.data.feedback_mode).toBe("instant");
  });

  it("stores the items shuffled and without their category; the pairs live only in the key", () => {
    const { challenge, key } = rows();
    const files = challenge.questions[0];
    expect(files.kind).toBe("match");
    if (files.kind !== "match") return;
    expect(files.items.map((i) => i.id)).not.toEqual(["framework", "workspace", "feedback"]);
    expect(files.items.every((i) => Object.keys(i).sort().join() === "id,label")).toBe(true);
    expect(JSON.stringify(challenge)).not.toMatch(/"match":|"answer"/);
    expect(key.answer_key.files).toEqual(["feedback=log", "framework=guide", "workspace=work"]);
  });

  it("knows whether each category takes one item", () => {
    const [files, sort] = rows().challenge.questions;
    expect(files).toMatchObject({ one_per_category: true });
    expect(sort).toMatchObject({ one_per_category: false });
  });

  it("keeps explanations private: in the key, never in the public row", () => {
    const { challenge, key } = rows();
    expect(key.explanations).toEqual({ files: "The framework guides, the workspace holds the work.", tf: "You are responsible for the result." });
    expect(JSON.stringify(challenge)).not.toContain("responsible");
  });

  it("keeps quoted True/False ids as strings", () => {
    expect(rows().key.answer_key.tf).toBe("true");
  });

  it("hashes feedback_mode only when instant, so existing challenges keep their hash", () => {
    const { challenge } = rows();
    const final = { ...challenge, feedback_mode: "final" as const };
    const { feedback_mode: _, ...without } = final; // eslint-disable-line @typescript-eslint/no-unused-vars
    expect(hashPublicContent(final)).toBe(hashPublicContent(without));
    expect(hashPublicContent(challenge)).not.toBe(hashPublicContent(final));
  });

  it("bumps the version when only an explanation changes", () => {
    const { challenge, settings, key } = rows();
    const db = {
      categories: [],
      challenges: [{ ...challenge, version: 3, ...settings }],
      keys: [{ ...key, explanations: { ...key.explanations, tf: "Older wording." } }],
    };
    const plan = planSync({ categories: [], challenges: [{ challenge, settings, key }] }, db);
    expect(plan.challengeWrites).toMatchObject([{ action: "update", row: { version: 4 } }]);
    // Unchanged: nothing to write.
    expect(planSync({ categories: [], challenges: [{ challenge, settings, key }] }, { ...db, keys: [key] }).challengeWrites).toEqual([]);
  });
});

describe("invalid match questions and instant feedback", () => {
  const { errors } = loadAndValidate(path.join(FIXTURES, "match-invalid"));
  const of = (slug: string) => errors.filter((e) => e.file.includes(slug)).map((e) => e.message);

  it("rejects duplicate ids, duplicate labels and unknown categories", () => {
    expect(of("bad-match")).toEqual(
      expect.arrayContaining([
        'question q1: duplicate category id "a"',
        'question q1: duplicate item id "x"',
        'question q1: two items are both "x" — each item must be different',
        'question q1: item "x" matches "nowhere", which is not a category id',
        'question q2: two categories are both "twin" — each category must be different',
      ]),
    );
  });

  it("rejects instant feedback on anything but an auto-graded quiz", () => {
    expect(of("bad-instant")).toContain("feedback_mode: instant only works on a quiz whose questions are all single, multi, order or match");
  });
});
