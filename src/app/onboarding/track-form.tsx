"use client";

import { useActionState } from "react";
import { AlertCircle, Briefcase, Clapperboard, ClipboardList, Compass, Crown, PenTool, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { TRACKS, type Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { chooseTrack } from "./actions";

const ICONS: Record<Track, LucideIcon> = {
  strategist: Compass,
  designer: PenTool,
  motion_designer: Clapperboard,
  account_manager: Briefcase,
  assistant: ClipboardList,
  management: Crown,
};

export function TrackForm() {
  const [state, action] = useActionState(chooseTrack, {});
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Your track</legend>
        {TRACKS.map(({ value, label, description }) => {
          const Icon = ICONS[value];
          return (
            <label
              key={value}
              className={cn(
                "border-input hover:bg-accent/50 flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                "has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="track" value={value} required className="sr-only" />
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
              <span className="text-muted-foreground text-sm">{description}</span>
            </label>
          );
        })}
      </fieldset>
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
    </form>
  );
}
