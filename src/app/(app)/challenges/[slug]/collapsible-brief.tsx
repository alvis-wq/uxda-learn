"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Whether the learner has started this attempt, shared between the stepped form (which knows) and the brief (which
 * sits elsewhere on the page). Started = a saved draft, a step past the first, or anything entered. The server
 * renders the brief; this only decides how much of it to show.
 */
type StartedContext = { started: boolean; setStarted: (started: boolean) => void };
const Started = createContext<StartedContext | null>(null);

export function BriefProvider({ initialStarted, children }: { initialStarted: boolean; children: ReactNode }) {
  const [started, setStarted] = useState(initialStarted);
  return <Started.Provider value={{ started, setStarted }}>{children}</Started.Provider>;
}

/** The form reports whether the learner has started. */
export function useReportStarted(started: boolean) {
  const ctx = useContext(Started);
  const setStarted = ctx?.setStarted;
  useEffect(() => setStarted?.(started), [setStarted, started]);
}

/**
 * The brief in full before the learner starts. Once they have, just its first paragraph with a "Show full brief"
 * toggle (a real button: Tab, Enter and Space work). Opening it is not remembered: it closes again whenever the
 * learner starts or starts over, and on every visit.
 */
export function CollapsibleBrief({ full, short }: { full: ReactNode; short: ReactNode | null }) {
  const started = useContext(Started)?.started ?? false;
  const collapsible = started && short !== null;
  // Remember which "started" state the learner opened it in, so a change of state closes it again.
  const [openedWhile, setOpenedWhile] = useState<boolean | null>(null);
  const open = openedWhile === started;
  const id = useId();

  if (!collapsible) return <>{full}</>;
  return (
    <div className="grid gap-2" data-testid="brief" data-collapsed={open ? undefined : ""}>
      <div id={id}>{open ? full : short}</div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpenedWhile(open ? null : started)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm outline-none focus-visible:ring-[3px]"
        data-testid="brief-toggle"
      >
        <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
        {open ? "Hide full brief" : "Show full brief"}
      </button>
    </div>
  );
}
