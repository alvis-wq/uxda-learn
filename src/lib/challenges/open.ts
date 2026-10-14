import "server-only";
import { isChallengeVisible } from "@/lib/challenges/model";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Track } from "@/lib/tracks";

/**
 * The challenge row if this track may act on it now (published and visible; or, for a tester, a visible draft), else
 * null. Service-role reads only, so this is the check that keeps a non-tester out of a draft. A draft row has
 * `status === "draft"`: the caller records the attempt as a test attempt.
 */
export async function loadOpenChallenge(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
  track: Track | null,
  tester = false,
) {
  const { data: row } = await admin.from("challenges").select("*").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const { data: category } = await admin
    .from("categories")
    .select("archived,audiences")
    .eq("slug", row.category_slug)
    .maybeSingle();
  return isChallengeVisible(row, category, track, tester) ? row : null;
}
