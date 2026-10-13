import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InProgressChallenge } from "@/lib/submissions/in-progress";
import { timeAgo } from "@/lib/utils";

/** Challenges with saved, unsubmitted work: where the learner left off, and a way back in. */
export function InProgressList({ items, now }: { items: InProgressChallenge[]; now: Date }) {
  return (
    <ul className="grid gap-3" data-testid="in-progress-list">
      {items.map((c) => (
        <li
          key={c.slug}
          data-testid="in-progress-row"
          data-slug={c.slug}
          className="bg-card flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border px-4 py-3"
        >
          <div className="grid min-w-0 gap-0.5">
            <p className="font-medium">{c.title}</p>
            <p className="text-muted-foreground text-meta">
              {c.categoryTitle} · saved {timeAgo(c.savedAt, now)}
            </p>
            {c.best && (
              <p className="text-muted-foreground text-meta" data-testid="in-progress-best">
                Best so far: <span className="tabular-nums">{c.best.score} / {c.best.max}</span>
              </p>
            )}
          </div>
          <Button asChild size="sm">
            <Link href={`/challenges/${c.slug}`} aria-label={`Continue ${c.title}`}>
              Continue
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
