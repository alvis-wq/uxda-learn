import "server-only";
import { isChallengeVisible } from "@/lib/challenges/model";
import { loadMilestonePlace } from "@/lib/data/paths";
import { lockReason } from "@/lib/paths/progress";
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

/**
 * For a path milestone: why this learner can't act on it now (they can't see its path, or it is locked because the
 * milestone before it has no attempt yet), else null. Null for a challenge that isn't a milestone. The page redirects
 * a locked milestone to its path; this is the server-side stop for submitting and saving.
 */
export async function milestoneGate(
  admin: ReturnType<typeof createAdminClient>,
  row: { slug: string; path_slug: string | null },
  viewer: { id: string; track: Track | null; is_tester: boolean },
): Promise<string | null> {
  const place = await loadMilestonePlace(admin, row, viewer);
  if (place === "hidden") return "This challenge isn't open for submissions.";
  const reason = lockReason(place);
  return reason ? `This milestone is locked. ${reason}` : null;
}
