import { isTestChallenge } from "@/lib/submissions/testing";
import { isVisibleToTrack, type Audience, type Track } from "@/lib/tracks";

/**
 * Featured challenges and paths: the home page's "Featured" section. An admin features an item for some tracks
 * (featured_for, Admin → Content); featured_at sets the order (oldest first, changed with move_featured). A learner
 * sees it there when it's featured for their track and they can see it (the home page only lists what they can see),
 * until they complete it.
 */

/**
 * When a challenge or path is featured for this track (its featured_for), else null. Drafts never are: a tester's
 * drafts stay under "Drafts — testing".
 */
export function featuredAtFor(
  row: { status: string; featured_for?: Audience[] | null; featured_at?: string | null },
  track: Track | null,
): string | null {
  if (isTestChallenge(row.status) || !row.featured_at) return null;
  return isVisibleToTrack(row.featured_for ?? [], track) ? row.featured_at : null;
}

/** A card the home page can feature: its kind (paths have `kind: "path"`) and when it was featured for this learner. */
type Featurable = { slug: string; kind?: "challenge" | "path"; featuredAt: string | null };

/**
 * A timestamptz as microseconds since the epoch. Postgres keeps microseconds (and move_featured may nudge a time by
 * one), a JS Date only milliseconds, so the fraction is read separately.
 */
export function toMicros(iso: string): number {
  const fraction = (iso.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  return Math.floor(Date.parse(iso.replace(/\.\d+/, "")) / 1000) * 1_000_000 + Number(fraction);
}

/** The featured order: oldest first, then challenges before paths, then by slug (the same order as move_featured). */
export function compareFeatured(a: Featurable, b: Featurable): number {
  const key = (x: Featurable) => `${x.kind === "path" ? "path" : "challenge"}:${x.slug}`;
  return toMicros(a.featuredAt!) - toMicros(b.featuredAt!) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

/**
 * The home page's "Featured" section and the list below it. `items` are the cards still on the home page (completed
 * ones already left out); the featured ones (featuredAt set: featured for this learner's track, never a draft) move to
 * the section, in the featured order, and are left out of the list, which keeps its own order (a chain of paths loses
 * a featured step but keeps the rest, each with its own "Step N of M").
 */
export function splitFeatured<T extends Featurable>(items: readonly T[]): { featured: T[]; rest: T[] } {
  return {
    featured: items.filter((i) => i.featuredAt).sort(compareFeatured),
    rest: items.filter((i) => !i.featuredAt),
  };
}
