"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

/**
 * Shown when the form opened with saved work: "Continue where you left off", with a Start over (confirmed in two
 * clicks, since it throws the saved answers away). When the challenge changed since the draft was saved, it also says
 * some answers were reset.
 */
export function DraftNotice({
  savedAt,
  reset,
  busy,
  onStartOver,
}: {
  savedAt: string;
  reset: boolean;
  busy: boolean;
  onStartOver: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // Fixed at first render: the text shouldn't tick while the learner reads it (and it keeps render pure).
  const [now] = useState(() => Date.now());

  return (
    <div data-testid="draft-notice" className="bg-card text-muted-foreground flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2">
        <History className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="text-foreground font-medium">Continue where you left off</span>
          <span> · saved {timeAgo(savedAt, now)}</span>
          {reset && (
            <span className="text-warning block" data-testid="draft-reset-note">
              Some answers were reset because this challenge was updated since you last worked on it.
            </span>
          )}
        </p>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <span className="text-foreground">Discard your saved answers?</span>
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onStartOver}>
            Yes, start over
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Keep them
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="-ml-2.5 self-start sm:ml-0 sm:shrink-0" disabled={busy} onClick={() => setConfirming(true)}>
          Start over
        </Button>
      )}
    </div>
  );
}
