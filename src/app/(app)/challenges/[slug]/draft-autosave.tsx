"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Autosaver, type SaveStatus } from "@/lib/submissions/autosave";
import type { DraftInput } from "@/lib/submissions/input";
import { saveDraft } from "./draft-actions";

/**
 * Saves the form to the server as the learner works (server action `saveDraft`), by the rules in `Autosaver`.
 * A hidden tab and an unmounting form send whatever is pending straight away.
 */
export function useDraftAutosave(slug: string, value: DraftInput, initial: DraftInput) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saver] = useState(() => new Autosaver<DraftInput>((v) => saveDraft(slug, v), setStatus, initial));
  const previousStep = useRef(value.step);

  useEffect(() => {
    saver.update(value, previousStep.current !== value.step);
    previousStep.current = value.step;
    // `value` is a new object every render; what matters is its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saver, JSON.stringify(value)]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void saver.flush();
    };
  }, [saver]);

  return {
    status,
    pause: () => saver.pause(),
    resume: () => saver.resume(),
    reset: (cleared: DraftInput) => saver.reset(cleared),
  };
}

/** The quiet "Saving…" / "Saved" line. A polite live region, so a screen reader hears it without being interrupted. */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  const text =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Couldn't save yet — trying again"
          : status === "stale"
            ? "This challenge was updated. Reload the page to keep saving."
            : "";
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="save-indicator"
      data-status={status}
      className={`text-meta flex items-center gap-1.5 ${status === "error" || status === "stale" ? "text-warning" : "text-muted-foreground"}`}
    >
      {status === "saved" && <Check className="size-3.5" aria-hidden />}
      {text}
    </p>
  );
}
