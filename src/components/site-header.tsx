import Link from "next/link";
import { Home, LogOut, Shield, Sparkles, Trophy, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UxdaLockup } from "@/components/uxda-lockup";
import { RubberNav } from "@/components/rubber-nav/RubberNav";
import { StickyHeader } from "@/components/sticky-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { canSeeTeam } from "@/lib/auth/roles";
import type { Profile } from "@/lib/auth/session";

export function SiteHeader({ profile }: { profile: Profile }) {
  return (
    <StickyHeader>
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-full px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      {/*
        Full viewport width (the page content keeps its own max-width): logo far left, actions far right, the navigation
        in the true centre of the viewport. The two outer columns are equal (1fr), so the centre column is centred on the
        viewport, not between the logo and the actions. Side padding: 16px on phones up to 80px on desktop.
      */}
      <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 max-[340px]:gap-1 max-[340px]:px-3 sm:px-6 md:px-10 lg:px-20">
        <Link href="/" className="flex items-center justify-self-start rounded-full font-semibold outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]">
          {/* The logo carries the "UXDA Learn" label; the visible word is hidden from assistive tech so it isn't read twice. */}
          <UxdaLockup className="gap-2 py-1" logoClassName="h-4 w-auto max-[340px]:h-3 sm:h-5" learnClassName="hidden sm:inline" />
        </Link>
        <div className="flex justify-center">
          <RubberNav
            items={[
              { href: "/", label: "Home", icon: <Home aria-hidden />, exact: true },
              { href: "/leaderboard", label: "Leaderboard", icon: <Trophy aria-hidden /> },
              { href: "/heroes", label: "Heroes", icon: <Sparkles aria-hidden /> },
              { href: "/profile", label: "Profile", icon: <UserRound aria-hidden /> },
              // Five icons at most (the narrow-phone sizes in RubberNav.css): admins reach Team from the admin menu.
              ...(profile.is_admin
                ? [{ href: "/admin", label: "Admin", icon: <Shield aria-hidden /> }]
                : canSeeTeam(profile)
                  ? [{ href: "/team", label: "Team", icon: <UsersRound aria-hidden /> }]
                  : []),
            ]}
          />
        </div>
        <div className="flex items-center justify-end gap-1 justify-self-end">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" aria-label="Sign out" className="max-[340px]:px-2">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </StickyHeader>
  );
}
