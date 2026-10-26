"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeamError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <AlertTriangle className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">Team progress couldn&apos;t load.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
