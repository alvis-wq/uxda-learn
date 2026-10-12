import Link from "next/link";
import { Home, LogOut, Shield, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UxdaLogo } from "@/components/uxda-logo";
import { RubberNav } from "@/components/rubber-nav/RubberNav";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Profile } from "@/lib/auth/session";

export function SiteHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b">
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-full px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 rounded-full font-semibold outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]">
            {/* The logo carries the "UXDA Learn" label; the visible word is hidden from assistive tech so it isn't read twice. */}
            <UxdaLogo className="h-4 w-auto sm:h-5" />
            <span aria-hidden className="hidden sm:inline">
              Learn
            </span>
          </Link>
          <RubberNav
            items={[
              { href: "/", label: "Home", icon: <Home aria-hidden />, exact: true },
              { href: "/leaderboard", label: "Leaderboard", icon: <Trophy aria-hidden /> },
              { href: "/profile", label: "Profile", icon: <UserRound aria-hidden /> },
              ...(profile.is_admin ? [{ href: "/admin", label: "Admin", icon: <Shield aria-hidden /> }] : []),
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
