import type { Metadata } from "next";
import { GLOW_CLEARANCE_CSS } from "@/components/aurora/geometry";
import { PageAurora } from "@/components/aurora/page-aurora";
import { HeroGrid } from "@/components/hero-grid";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { loadHeroes } from "@/lib/heroes";

export const metadata: Metadata = { title: "Heroes · UXDA Learn" };

export default async function HeroesPage() {
  await requireOnboardedProfile();

  return (
    // Bottom padding = how high the aurora's glow reaches (see aurora/geometry.ts), as on home.
    <main className="mx-auto w-full max-w-5xl px-4 pt-10" style={{ paddingBottom: GLOW_CLEARANCE_CSS }}>
      <PageAurora />
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">UXDA Superhero Team</h1>
        <p className="text-muted-foreground mt-1">Meet the heroes behind UXDA: who they are and what makes them super.</p>
      </div>
      <HeroGrid heroes={loadHeroes()} />
    </main>
  );
}
