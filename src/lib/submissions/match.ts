import { matchPair, parseMatchPairs } from "@/lib/content/schema";

type Option = { id: string; label: string };

/** The drop zone (and menu entry) for items not on a category yet. */
export const POOL = "__pool";

/**
 * Where each item is: its category id, or absent while it's still in the pool. Pairs naming an unknown item or
 * category are ignored.
 */
export function placementsOf(items: Option[], categories: Option[], value: string[] | undefined): Map<string, string> {
  const known = new Set(categories.map((c) => c.id));
  const out = new Map<string, string>();
  for (const [item, category] of parseMatchPairs(value ?? [])) {
    if (items.some((i) => i.id === item) && known.has(category)) out.set(item, category);
  }
  return out;
}

/**
 * Put `item` on `category` (or back in the pool). When each category holds one item, the item already there goes
 * back to the pool. Returns the new answer, in item order.
 */
export function place(
  items: Option[],
  placements: Map<string, string>,
  item: string,
  category: string,
  onePerCategory: boolean,
): { pairs: string[]; displaced: string | null } {
  const next = new Map(placements);
  let displaced: string | null = null;
  if (category === POOL) next.delete(item);
  else {
    if (onePerCategory) {
      for (const [other, c] of next) {
        if (c === category && other !== item) {
          next.delete(other);
          displaced = other;
        }
      }
    }
    next.set(item, category);
  }
  const pairs = items.flatMap((i) => (next.has(i.id) ? [matchPair(i.id, next.get(i.id)!)] : []));
  return { pairs, displaced };
}
