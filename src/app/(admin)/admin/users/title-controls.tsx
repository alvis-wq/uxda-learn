"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOB_TITLE_MAX } from "@/lib/staff-titles";
import { setStaffTitle, updatePendingStaff } from "../actions";

/** Job title shown under the person's name. Empty + Save removes it. */
export function TitleField({ email, name, title }: { email: string; name: string; title: string | undefined }) {
  const [value, setValue] = useState(title ?? "");
  const [saved, setSaved] = useState(title ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const dirty = value.trim() !== saved;

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setStaffTitle(email, value);
          if (!res.ok) {
            setError(res.error);
            toast.error(res.error);
            return;
          }
          const next = value.trim();
          setSaved(next);
          setValue(next);
          setError(undefined);
          toast.success(next ? `Title updated for ${name}.` : `Title removed for ${name}.`);
        });
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Job title for ${name}`}
        aria-invalid={error ? true : undefined}
        placeholder="No title"
        maxLength={JOB_TITLE_MAX}
        disabled={pending}
        className="h-8 w-44"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty} aria-label={`Save job title for ${name}`}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save
      </Button>
    </form>
  );
}

/** A seeded title whose email nobody has signed in with yet: fix the email, change the title, or remove it. */
export function PendingStaffRow({ email, title }: { email: string; title: string }) {
  const [emailValue, setEmailValue] = useState(email);
  const [titleValue, setTitleValue] = useState(title);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const dirty = emailValue.trim().toLowerCase() !== email || titleValue.trim() !== title;
  const errorId = `pending-error-${email}`;

  return (
    <li className="grid gap-2 py-3" data-testid={`pending-staff-${email}`}>
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updatePendingStaff(email, emailValue, titleValue);
            if (!res.ok) {
              setError(res.error);
              toast.error(res.error);
              return;
            }
            setError(undefined);
            toast.success("Saved.");
          });
        }}
      >
        <Input
          type="email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          aria-label={`Email for ${email}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={pending}
          className="h-8"
        />
        <Input
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          aria-label={`Job title for ${email}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          maxLength={JOB_TITLE_MAX}
          disabled={pending}
          className="h-8"
        />
        <div className="flex gap-1.5">
          <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty} aria-label={`Save ${email}`}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={`Remove the title for ${email}`}
            onClick={() =>
              start(async () => {
                const res = await setStaffTitle(email, "");
                if (!res.ok) {
                  setError(res.error);
                  toast.error(res.error);
                } else toast.success(`Removed ${email}.`);
              })
            }
          >
            Remove
          </Button>
        </div>
      </form>
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
