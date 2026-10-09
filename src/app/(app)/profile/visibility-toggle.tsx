"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setLeaderboardVisibility } from "./actions";

export function VisibilityToggle({ initial }: { initial: boolean }) {
  const [pending, startTransition] = useTransition();
  const [visible, setVisible] = useOptimistic(initial);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-1">
        <Label htmlFor="leaderboard-visibility">Show me on the leaderboard</Label>
        <p className="text-muted-foreground text-sm">
          When off, your name and score are hidden from others. Your own scores still count.
        </p>
      </div>
      <Switch
        id="leaderboard-visibility"
        checked={visible}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            setVisible(next);
            const res = await setLeaderboardVisibility(next);
            if (res.error) toast.error(res.error);
            else toast.success(next ? "You're on the leaderboard." : "You're hidden from the leaderboard.");
          })
        }
      />
    </div>
  );
}
