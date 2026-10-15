"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const WAITING_INFO_TEXT = "Waiting time is when Claude Code is working on its own. You can do other tasks meanwhile.";

/**
 * The info button after "~N min waiting". Hover (mouse) or keyboard focus shows the explanation; a click or tap pins
 * it open until the next click or tap, a tap elsewhere, or Escape. Focus stays on the button. It sits above a card's
 * or roadmap node's full-size link (z-20 over their z-10 overlay) without being inside it, and its popup is portalled,
 * so a card's overflow never clips it.
 */
export function WaitingInfo({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // Opened by a click or tap: stays open when the pointer leaves or focus moves on.
  const [pinned, setPinned] = useState(false);
  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label="What is waiting time?"
        data-testid="waiting-info"
        className={cn(
          // A 24px target, pulled in by -m-1 so the line keeps its rhythm.
          "relative z-20 -m-1 inline-grid size-6 shrink-0 cursor-help place-items-center rounded-full align-middle text-current outline-none",
          "hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className,
        )}
        onClick={(e) => {
          // Radix would toggle; a click on a hover-opened popup pins it instead of closing it.
          e.preventDefault();
          if (pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !pinned) setOpen(false);
        }}
        onFocus={(e) => {
          // Keyboard focus only: a click focuses the button too, and its onClick decides.
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
      >
        <Info className="size-3.5" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          sideOffset={6}
          collisionPadding={16}
          // Keep focus on the button: the popup only explains, there is nothing to do in it.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          data-testid="waiting-info-popup"
          className="bg-popover text-popover-foreground z-50 max-w-64 rounded-md border px-3 py-2 text-sm leading-snug shadow-md"
        >
          {WAITING_INFO_TEXT}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
