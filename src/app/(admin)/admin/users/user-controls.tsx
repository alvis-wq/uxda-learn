"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TRACKS } from "@/lib/tracks";
import { setUserAdmin, setUserTester, setUserTrack } from "../actions";

export function TrackSelect({ userId, name, track }: { userId: string; name: string; track: string | null }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(track ?? "");
  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(next) =>
        start(async () => {
          setValue(next);
          const res = await setUserTrack(userId, next);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Track updated for ${name}.`);
        })
      }
    >
      <SelectTrigger size="sm" className="w-44" aria-label={`Track for ${name}`}>
        <SelectValue placeholder="Not chosen" />
      </SelectTrigger>
      <SelectContent>
        {TRACKS.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminSwitch({
  userId,
  name,
  isAdmin,
  isSelf,
}: {
  userId: string;
  name: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useOptimistic(isAdmin);
  return (
    <Switch
      checked={checked}
      disabled={pending || isSelf}
      aria-label={`Admin access for ${name}`}
      title={isSelf ? "You can't remove your own admin access" : undefined}
      onCheckedChange={(next) =>
        start(async () => {
          setChecked(next);
          const res = await setUserAdmin(userId, next);
          if (!res.ok) toast.error(res.error);
          else toast.success(next ? `${name} is now an admin.` : `${name} is no longer an admin.`);
        })
      }
    />
  );
}

/** Testers can see and try draft challenges their track can see. Any user, any track. */
export function TesterSwitch({ userId, name, isTester }: { userId: string; name: string; isTester: boolean }) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useOptimistic(isTester);
  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={`Tester access for ${name}`}
      onCheckedChange={(next) =>
        start(async () => {
          setChecked(next);
          const res = await setUserTester(userId, next);
          if (!res.ok) toast.error(res.error);
          else toast.success(next ? `${name} can now test drafts.` : `${name} can no longer test drafts.`);
        })
      }
    />
  );
}

