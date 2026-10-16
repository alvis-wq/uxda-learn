import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "@/lib/content/schema";
import { attemptSeed, shuffleForAttempt } from "./shuffle";

const opts = (...ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase() }));
const questions: PublicQuestion[] = [
  { id: "q1", kind: "single", prompt: "1", points: 1, options: opts("a", "b", "c", "d") },
  { id: "q2", kind: "multi", prompt: "2", points: 1, options: opts("a", "b", "c", "d", "e") },
  { id: "q3", kind: "order", prompt: "3", points: 1, items: opts("s1", "s2", "s3", "s4") },
  {
    id: "q4", kind: "match", prompt: "4", points: 1, one_per_category: true,
    categories: opts("c1", "c2", "c3"), items: opts("x", "y", "z"),
  },
  { id: "q5", kind: "single", prompt: "5", points: 1, options: [{ id: "true", label: "True" }, { id: "false", label: "False" }] },
];
const key = { q3: ["s1", "s2", "s3", "s4"] };
const ids = (q: PublicQuestion) => (q.kind === "text" ? [] : (q.kind === "order" || q.kind === "match" ? q.items : q.options).map((o) => o.id));
const seed = (attempt: number) => attemptSeed("user-1", "quiz", attempt, false);

describe("shuffleForAttempt", () => {
  it("is stable for one attempt, so a refresh shows the same order", () => {
    expect(shuffleForAttempt(questions, seed(1), key)).toEqual(shuffleForAttempt(questions, seed(1), key));
  });

  it("gives other attempts (and other learners) other orders", () => {
    const orders = new Set(
      [1, 2, 3, 4, 5].flatMap((n) => [seed(n), attemptSeed("user-2", "quiz", n, false), attemptSeed("user-1", "quiz", n, true)]).map((s) =>
        JSON.stringify(shuffleForAttempt(questions, s, key).map((q) => [q.id, ids(q)])),
      ),
    );
    expect(orders.size).toBeGreaterThan(10);
  });

  it("keeps every question, option and item", () => {
    const out = shuffleForAttempt(questions, seed(1), key);
    expect(out.map((q) => q.id).sort()).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    for (const q of out) expect(ids(q).sort()).toEqual(ids(questions.find((x) => x.id === q.id)!).sort());
  });

  it("never starts an order question in the right order", () => {
    for (let n = 1; n <= 300; n++) {
      const q3 = shuffleForAttempt(questions, seed(n), key).find((q) => q.id === "q3")!;
      expect(ids(q3), `attempt ${n}`).not.toEqual(key.q3);
    }
  });

  it("keeps True/False in that order and a match question's categories as written", () => {
    for (let n = 1; n <= 20; n++) {
      const out = shuffleForAttempt(questions, seed(n), key);
      expect(ids(out.find((q) => q.id === "q5")!)).toEqual(["true", "false"]);
      const q4 = out.find((q) => q.id === "q4")!;
      expect(q4.kind === "match" && q4.categories.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    }
  });

  it("keeps the question order of a challenge with written questions", () => {
    const withText: PublicQuestion[] = [...questions, { id: "t", kind: "text", prompt: "Why?", points: 1 }];
    for (let n = 1; n <= 10; n++) {
      expect(shuffleForAttempt(withText, seed(n), key).map((q) => q.id)).toEqual(withText.map((q) => q.id));
    }
  });
});
