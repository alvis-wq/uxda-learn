import { describe, expect, it } from "vitest";
import { compareFeatured, featuredAtFor, splitFeatured, toMicros } from "./featured";
import { groupChains, isCompletedOnHome } from "./home-order";

const AT = "2026-10-20T09:00:00.000000+00:00";

describe("featuredAtFor", () => {
  it("is set for the tracks it's featured for, everyone included", () => {
    expect(featuredAtFor({ status: "published", featured_for: ["designer"], featured_at: AT }, "designer")).toBe(AT);
    expect(featuredAtFor({ status: "published", featured_for: ["all"], featured_at: AT }, "strategist")).toBe(AT);
  });

  it("is null for other tracks, no track, or when not featured", () => {
    expect(featuredAtFor({ status: "published", featured_for: ["designer"], featured_at: AT }, "strategist")).toBeNull();
    expect(featuredAtFor({ status: "published", featured_for: ["designer"], featured_at: AT }, null)).toBeNull();
    expect(featuredAtFor({ status: "published", featured_for: [], featured_at: null }, "designer")).toBeNull();
    expect(featuredAtFor({ status: "published" }, "designer")).toBeNull(); // before the migration's columns
  });

  it("is never set for a draft: a tester's drafts stay under Drafts — testing", () => {
    expect(featuredAtFor({ status: "draft", featured_for: ["all"], featured_at: AT }, "designer")).toBeNull();
  });
});

describe("the featured order", () => {
  it("reads microseconds (a JS Date alone would tie them)", () => {
    expect(toMicros("2026-10-20T09:00:00.000002+00:00") - toMicros("2026-10-20T09:00:00.000001+00:00")).toBe(1);
    expect(toMicros("2026-10-20T11:00:00+02:00")).toBe(toMicros("2026-10-20T09:00:00Z"));
    expect(toMicros("2026-10-20T09:00:00+00:00")).toBeLessThan(toMicros("2026-10-20T09:00:00.5+00:00"));
  });

  it("is oldest first, then challenges before paths, then by slug (as move_featured)", () => {
    const items = [
      { slug: "b", featuredAt: "2026-10-20T09:00:00.000002+00:00" },
      { slug: "z", kind: "path" as const, featuredAt: "2026-10-20T09:00:00.000001+00:00" },
      { slug: "a", kind: "path" as const, featuredAt: "2026-10-20T09:00:00.000001+00:00" },
      { slug: "m", kind: "challenge" as const, featuredAt: "2026-10-20T09:00:00.000001+00:00" },
      { slug: "old", featuredAt: "2026-10-01T09:00:00+00:00" },
    ];
    expect([...items].sort(compareFeatured).map((i) => i.slug)).toEqual(["old", "m", "a", "z", "b"]);
  });
});

type Card = {
  slug: string;
  kind?: "challenge" | "path";
  featuredAt: string | null;
  done: boolean;
  inProgress: boolean;
  lockedBy?: string | null;
  chain?: { id: string; step: number; of: number } | null;
};
const card = (slug: string, over: Partial<Card> = {}): Card => ({ slug, featuredAt: null, done: false, inProgress: false, ...over });

describe("splitFeatured", () => {
  it("moves featured cards to the section, in the featured order, and out of the list", () => {
    const list = [
      card("one"),
      card("late", { featuredAt: "2026-10-21T09:00:00+00:00" }),
      card("two"),
      card("early", { kind: "path", featuredAt: "2026-10-01T09:00:00+00:00" }),
    ];
    const { featured, rest } = splitFeatured(list);
    expect(featured.map((c) => c.slug)).toEqual(["early", "late"]);
    expect(rest.map((c) => c.slug)).toEqual(["one", "two"]); // the list keeps its own order
  });

  it("has nothing to show when nothing is featured (the section is then left out)", () => {
    expect(splitFeatured([card("one"), card("two")]).featured).toEqual([]);
  });

  it("never shows a completed item (the page splits what's still on the list)", () => {
    const cards = [card("done", { featuredAt: AT, done: true }), card("retry", { featuredAt: AT, done: true, inProgress: true })];
    expect(splitFeatured(cards.filter((c) => !isCompletedOnHome(c))).featured.map((c) => c.slug)).toEqual(["retry"]);
  });

  it("keeps a locked path's lock", () => {
    const locked = card("p", { kind: "path", featuredAt: AT, lockedBy: "First path" });
    expect(splitFeatured([locked]).featured[0].lockedBy).toBe("First path");
  });

  it("takes a featured step out of its chain; the rest keep their order and step numbers", () => {
    const chain = (step: number) => ({ id: "c1", step, of: 3 });
    const grouped = groupChains(
      [card("s1", { kind: "path", chain: chain(1) }), card("s2", { kind: "path", chain: chain(2), featuredAt: AT }), card("s3", { kind: "path", chain: chain(3) })],
      (c) => c.chain ?? null,
      (c) => c.done,
    );
    const { featured, rest } = splitFeatured(grouped);
    expect(featured.map((c) => c.slug)).toEqual(["s2"]);
    expect(rest.map((c) => [c.slug, c.chain?.step])).toEqual([["s1", 1], ["s3", 3]]);
  });
});
