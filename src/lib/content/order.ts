/**
 * Starting order for an "order" question. The public row of a challenge is readable by every learner, so it must
 * never list the items in the correct order: sync stores them shuffled instead (the correct order lives only in
 * challenge_keys). The shuffle is a pure function of the question, so re-syncing unchanged content gives the same
 * order (no spurious version bump) and everyone starts from the same scrambled list.
 */

/** FNV-1a: a small, stable string hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded random number generator. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `items` (in the correct order) in a fixed shuffled order that is never the correct one. */
export function shuffleItems<T extends { id: string }>(questionId: string, items: readonly T[]): T[] {
  const rand = random(hash(`${questionId}|${items.map((i) => i.id).join("|")}`));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Items are unique (validate.ts), so equal ids in the same places means the correct order.
  if (out.length > 1 && out.every((item, i) => item.id === items[i].id)) out.push(out.shift()!);
  return out;
}
