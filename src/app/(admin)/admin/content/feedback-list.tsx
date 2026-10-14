import { MessageSquareText } from "lucide-react";
import type { FeedbackItem } from "@/lib/data/admin-content";
import { formatDateTime } from "@/lib/utils";

/** Tester feedback on one challenge, newest first, with who wrote it and when. */
export function FeedbackList({ items, open = false }: { items: FeedbackItem[]; open?: boolean }) {
  return (
    <details className="group text-sm" open={open} data-testid="feedback-list">
      <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1.5 text-meta">
        <MessageSquareText className="size-4" aria-hidden />
        Tester feedback ({items.length})
      </summary>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-meta">No feedback yet. Testers can write some while the challenge is a draft.</p>
      ) : (
        <ol className="mt-2 grid gap-3 border-l pl-4">
          {items.map((f) => (
            <li key={f.id} className="grid gap-0.5" data-testid="feedback-item">
              <p className="whitespace-pre-line">{f.body}</p>
              <p className="text-muted-foreground text-meta">
                {f.who} · <time dateTime={f.created_at}>{formatDateTime(f.created_at)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
