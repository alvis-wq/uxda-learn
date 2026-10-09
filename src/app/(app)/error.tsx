"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <AlertTriangle className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        We couldn&apos;t load this page. Try again — if it keeps happening, let Alvis know.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
