import Link from "next/link";
import { Home, LogOut, Shield, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UxdaLogo } from "@/components/uxda-logo";
import { RubberNav } from "@/components/rubber-nav/RubberNav";
import { StickyHeader } from "@/components/sticky-header";
import { ThemeToggle } from "@/components/theme-toggle";
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
      {/* Logo left, navigation centred, actions right. The side columns are equal so the nav stays centred. */}
      <div className="mx-auto grid h-14 w-full max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center gap-2 justify-self-start rounded-full font-semibold outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]">
          {/* The logo carries the "UXDA Learn" label; the visible word is hidden from assistive tech so it isn't read twice. */}
          <UxdaLogo className="h-4 w-auto sm:h-5" />
          <span aria-hidden className="hidden sm:inline">
            Learn
          </span>
        </Link>
        <div className="flex min-w-0 justify-center">
          <RubberNav
            items={[
              { href: "/", label: "Home", icon: <Home aria-hidden />, exact: true },
              { href: "/leaderboard", label: "Leaderboard", icon: <Trophy aria-hidden /> },
              { href: "/profile", label: "Profile", icon: <UserRound aria-hidden /> },
              ...(profile.is_admin ? [{ href: "/admin", label: "Admin", icon: <Shield aria-hidden /> }] : []),
            ]}
          />
        </div>
        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </div>
    </StickyHeader>
  );
}
