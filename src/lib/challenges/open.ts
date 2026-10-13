import "server-only";
import { isChallengeVisible } from "@/lib/challenges/model";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Track } from "@/lib/tracks";

/** The challenge row if this track may act on it now (published, visible), else null. Service-role reads only. */
export async function loadOpenChallenge(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
  track: Track | null,
) {
  const { data: row } = await admin.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const { data: category } = await admin
    .from("categories")
    .select("archived,audiences")
    .eq("slug", row.category_slug)
    .maybeSingle();
  return isChallengeVisible(row, category, track) ? row : null;
}
