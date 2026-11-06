"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAcademyReading } from "./actions";

/** "Reading now" on a book card: a toggle button, saved straight away and switched back the same way. */
export function ReadingToggle({ resourceId, title, reading }: { resourceId: string; title: string; reading: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(reading);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const res = await setAcademyReading(resourceId, next).catch(() => ({ ok: false as const, error: "Couldn't save that. Please try again." }));
      if (!res.ok) {
        setOn(!next);
        setError(res.error);
      } else router.refresh();
    });
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={on ? "default" : "outline"}
        className="h-7 px-2.5 text-xs"
        aria-pressed={on}
        aria-label={`${title}: reading now`}
        disabled={pending}
        onClick={toggle}
        data-testid="reading-toggle"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <BookMarked className="size-3.5" aria-hidden />}
        Reading now
      </Button>
      {error && (
        <p className="text-meta text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
