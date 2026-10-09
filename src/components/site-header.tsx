import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Profile } from "@/lib/auth/session";

const TRACK_LABEL = { strategist: "Strategist", designer: "Designer" } as const;

export function SiteHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-brand size-5 rounded" aria-hidden />
          UXDA Learn
        </Link>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground mr-2 hidden text-sm sm:inline">
            {profile.full_name ?? profile.email}
            {profile.track && <> · {TRACK_LABEL[profile.track]}</>}
          </span>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
