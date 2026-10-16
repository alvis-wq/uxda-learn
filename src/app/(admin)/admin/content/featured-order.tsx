"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Route, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSettingValue } from "@/lib/admin/challenge-settings";
import type { Audience } from "@/lib/tracks";
import { moveFeatured } from "./actions";

export type FeaturedItem = {
  kind: "challenge" | "path";
  slug: string;
  title: string;
  categoryTitle: string;
  status: string;
  featuredFor: Audience[];
};

type Direction = "up" | "down";
const keyOf = (i: { kind: string; slug: string }) => `${i.kind}:${i.slug}`;

/**
 * The home page's "Featured" items in their order (learners see them in this order, those their track can see and
 * haven't completed). Move up / Move down saves at once (move_featured, in both items' change history). Featuring is
 * switched on and off on each challenge or path below.
 */
export function FeaturedOrder({ items }: { items: FeaturedItem[] }) {
  const [pending, start] = useTransition();
  const [list, swap] = useOptimistic(items, (current, { index, to }: { index: number; to: number }) => {
    const next = [...current];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });

  // After a move, focus stays on the item that moved: on the button just used, or the other one at the list's end.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ key: string; direction: Direction } | null>(null);
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    const index = list.findIndex((i) => keyOf(i) === target.key);
    const atEdge = target.direction === "up" ? index === 0 : index === list.length - 1;
    const other: Direction = target.direction === "up" ? "down" : "up";
    buttons.current.get(`${target.key}:${atEdge ? other : target.direction}`)?.focus();
    refocus.current = null;
  }, [list]);

  function move(item: FeaturedItem, direction: Direction) {
    const index = list.findIndex((i) => keyOf(i) === keyOf(item));
    const to = direction === "up" ? index - 1 : index + 1;
    // One move at a time. The buttons stay enabled meanwhile: disabling the focused one would drop keyboard focus.
    if (pending || to < 0 || to >= list.length) return;
    refocus.current = { key: keyOf(item), direction };
    start(async () => {
      swap({ index, to });
      const res = await moveFeatured({ kind: item.kind, slug: item.slug, direction });
      if (!res.ok) toast.error(res.error);
      else toast.success(`“${item.title}” moved to #${to + 1} in Featured.`);
    });
  }

  return (
    <section aria-labelledby="featured-order-heading" className="grid gap-3" data-testid="featured-order">
      <div>
        <h2 id="featured-order-heading" className="font-semibold">
          Featured on home
        </h2>
        <p className="text-muted-foreground text-meta mt-1 max-w-3xl">
          Learners see these at the top of their home page, in this order: the ones featured for their track that they can
          see and haven&apos;t completed. Turn featuring on or off on a challenge or path below.
        </p>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Star} title="Nothing featured" description="Turn on “Feature on home” on a challenge or path below." />
      ) : (
        <ol className="grid gap-2">
          {list.map((item, i) => (
            <li
              key={keyOf(item)}
              className="bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border py-2 pr-2 pl-3"
              data-testid="featured-item"
              data-slug={item.slug}
            >
              <span className="text-muted-foreground w-6 shrink-0 text-sm tabular-nums">{i + 1}.</span>
              <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                <Link
                  href={item.kind === "path" ? `/paths/${item.slug}` : `/challenges/${item.slug}`}
                  className="flex items-center gap-1.5 text-sm font-medium [overflow-wrap:anywhere] hover:underline"
                >
                  {item.kind === "path" && <Route className="size-4 shrink-0" aria-hidden />}
                  {item.title}
                  {item.kind === "path" && <span className="sr-only"> (path)</span>}
                </Link>
                <p className="text-muted-foreground text-meta">
                  {item.categoryTitle} · for {formatSettingValue("featured_for", item.featuredFor)}
                </p>
              </div>
              {item.status !== "published" && (
                <Badge variant="outline" title="Learners only see it once it's published">
                  {item.status === "draft" ? "Draft: not shown yet" : "Archived: not shown"}
                </Badge>
              )}
              <div className="flex shrink-0 items-center">
                {(["up", "down"] as const).map((direction) => (
                  <Button
                    key={direction}
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={direction === "up" ? i === 0 : i === list.length - 1}
                    onClick={() => move(item, direction)}
                    ref={(el: HTMLButtonElement | null) => {
                      const k = `${keyOf(item)}:${direction}`;
                      if (el) buttons.current.set(k, el);
                      else buttons.current.delete(k);
                    }}
                    aria-label={`Move ${item.title} ${direction}`}
                  >
                    {direction === "up" ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
