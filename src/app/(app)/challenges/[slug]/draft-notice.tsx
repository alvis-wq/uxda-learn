"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

/**
 * One quiet line when the form opened with saved work: "Saved 21 hours ago · Start over". Start over is a small text
 * button that asks for a confirmation first (it throws the saved answers away). When the challenge changed since the
 * draft was saved, a second line says some answers were reset.
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
    <div data-testid="draft-notice" className="text-muted-foreground text-meta grid gap-0.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Saved {timeAgo(savedAt, now)}</span>
        <span aria-hidden>·</span>
        {confirming ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground">Discard your saved answers?</span>
            <Button type="button" size="sm" variant="destructive" className="h-6 px-2.5 text-xs" disabled={busy} onClick={onStartOver}>
              Yes, start over
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={busy} onClick={() => setConfirming(false)}>
              Keep them
            </Button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px] disabled:opacity-50"
          >
            Start over
          </button>
        )}
      </p>
      {reset && (
        <p className="text-warning" data-testid="draft-reset-note">
          Some answers were reset because this challenge was updated since you last worked on it.
        </p>
      )}
    </div>
  );
}
