"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acknowledgeChallenge } from "./actions";

export function AcknowledgeForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await acknowledgeChallenge(slug);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        toast.success("Thanks — your confirmation is recorded.");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground">
        Confirm once you&apos;ve read the brief above. We record who confirmed and when.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="button" onClick={onConfirm} disabled={pending} className="w-full sm:w-fit">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
        {pending ? "Saving…" : "I've read and understood"}
      </Button>
    </div>
  );
}
