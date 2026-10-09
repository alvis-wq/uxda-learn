import Link from "next/link";
import { Home, LogOut, Shield, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Profile } from "@/lib/auth/session";

export function SiteHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b">
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-brand size-5 rounded" aria-hidden />
            <span className="hidden sm:inline">UXDA Learn</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink href="/" icon={<Home aria-hidden />} label="Home" exact />
            <NavLink href="/leaderboard" icon={<Trophy aria-hidden />} label="Leaderboard" />
            <NavLink href="/profile" icon={<UserRound aria-hidden />} label="Profile" />
            {profile.is_admin && <NavLink href="/admin" icon={<Shield aria-hidden />} label="Admin" />}
          </nav>
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
