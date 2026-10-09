"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { setUserAdmin, setUserTrack } from "../actions";

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
      <SelectTrigger size="sm" className="w-36" aria-label={`Track for ${name}`}>
        <SelectValue placeholder="Not chosen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="strategist">Strategist</SelectItem>
        <SelectItem value="designer">Designer</SelectItem>
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
