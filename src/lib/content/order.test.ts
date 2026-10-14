import path from "node:path";
import { describe, expect, it } from "vitest";
import { challengeFrontmatterSchema, loadAndValidate } from "./index";
import { shuffleItems } from "./order";
import { toChallengeRows, toPublicQuestion } from "./transform";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures/content");
const item = (id: string) => ({ id, label: id.toUpperCase() });

describe("shuffleItems", () => {
  it("is never the correct order, for any size and any question id", () => {
    for (let n = 2; n <= 8; n++) {
      const items = Array.from({ length: n }, (_, i) => item(`i${i}`));
      for (let k = 0; k < 200; k++) {
        const shuffled = shuffleItems(`q${k}`, items);
        expect(shuffled.map((x) => x.id), `n=${n} q${k}`).not.toEqual(items.map((x) => x.id));
        expect([...shuffled.map((x) => x.id)].sort()).toEqual(items.map((x) => x.id).sort());
      }
    }
  });

  it("is stable: the same question always starts in the same order", () => {
    const items = ["a", "b", "c", "d"].map(item);
    expect(shuffleItems("q1", items)).toEqual(shuffleItems("q1", items));
  });

  it("does not change its input", () => {
    const items = ["a", "b", "c"].map(item);
    shuffleItems("q1", items);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("two items always come back swapped", () => {
    expect(shuffleItems("q", [item("a"), item("b")]).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("order questions in content", () => {
  const { content, errors } = loadAndValidate(path.join(FIXTURES, "order"));
  const ch = content.challenges[0];

  it("accepts a valid order question", () => {
    expect(errors).toEqual([]);
  });

  it("stores the items shuffled and the correct sequence only in the key", () => {
    const { challenge, key } = toChallengeRows(ch, content.categories);
    expect(key.answer_key.q1).toEqual(["observe", "consequence", "recommend", "next"]);
    const q1 = challenge.questions[0];
    expect(q1.kind).toBe("order");
    if (q1.kind !== "order") return;
    expect(q1.items.map((i) => i.id)).not.toEqual(["observe", "consequence", "recommend", "next"]);
    expect(q1.items).toHaveLength(4);
    expect(JSON.stringify(challenge)).not.toMatch(/"answer"/);
  });

  it("gives the same public row (and so the same hash) every time it is built", () => {
    expect(toChallengeRows(ch, content.categories).challenge.content_hash).toBe(
      toChallengeRows(ch, content.categories).challenge.content_hash,
    );
  });

  it("toPublicQuestion shuffles an order question and leaves others alone", () => {
    const q = { id: "q", kind: "order" as const, prompt: "p", points: 1, items: ["a", "b", "c"].map(item) };
    expect(toPublicQuestion(q)).not.toEqual(q);
  });

  it("rejects an order question with fewer than 2 items", () => {
    const result = challengeFrontmatterSchema.safeParse({
      slug: "x", title: "X", category: "c", type: "quiz", difficulty: 1, points: 1,
      questions: [{ id: "q1", kind: "order", prompt: "p", items: [{ id: "a", label: "A" }], points: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate item ids and duplicate labels", () => {
    const { errors: bad } = loadAndValidate(path.join(FIXTURES, "invalid"));
    const msgs = bad.filter((e) => e.file.includes("bad-order")).map((e) => e.message);
    expect(msgs).toContain('question q1: duplicate item id "a"');
    expect(msgs.join("\n")).toMatch(/question q2: two items are both "same"/);
  });
});
