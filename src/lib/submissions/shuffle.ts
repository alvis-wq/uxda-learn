import { seededShuffle } from "@/lib/content/order";
import type { PublicQuestion } from "@/lib/content/schema";
import type { AnswerKey } from "./grading";

/**
 * Every new attempt shows the questions (in a quiz without written questions), and the options or items within
 * each, in its own order. The order comes from a seed (learner, challenge, which attempt), so a refresh shows the
 * same order and nothing has to be stored; grading goes by id, so it never depends on the order. Runs on the server:
 * an order question's starting order is checked against the key there, and the key never leaves it.
 */
export function attemptSeed(userId: string, slug: string, attempt: number, testing: boolean): string {
  return `${userId}|${slug}|${testing ? "test" : "attempt"}|${attempt}`;
}

/** A True/False pair keeps its order: shuffled, it would only read oddly. */
function isTrueFalse(options: readonly { label: string }[]): boolean {
  const labels = options.map((o) => o.label.trim().toLowerCase());
  return labels.length === 2 && labels.includes("true") && labels.includes("false");
}

export function shuffleForAttempt(questions: readonly PublicQuestion[], seed: string, key: AnswerKey): PublicQuestion[] {
  const each = (q: PublicQuestion): PublicQuestion => {
    const s = `${seed}|${q.id}`;
    switch (q.kind) {
      case "single":
      case "multi":
        return isTrueFalse(q.options) ? q : { ...q, options: seededShuffle(s, q.options) };
      case "order": {
        const items = seededShuffle(s, q.items);
        const correct = key[q.id];
        // Never start in the right order (items are unique, so moving the first to the end always breaks it).
        if (items.length > 1 && Array.isArray(correct) && items.every((item, i) => item.id === correct[i])) items.push(items.shift()!);
        return { ...q, items };
      }
      case "match":
        // Categories keep their authored order (often a sequence worth reading in order); the items move.
        return { ...q, items: seededShuffle(s, q.items) };
      case "text":
        return q;
    }
  };
  // Written questions often build on each other, so only an all-auto-graded quiz has its questions reordered.
  const ordered = questions.every((q) => q.kind !== "text") ? seededShuffle(`${seed}|questions`, questions) : questions;
  return ordered.map(each);
}
