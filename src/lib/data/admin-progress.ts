import "server-only";
import type { ProgressInput } from "@/lib/admin/required-progress";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything the required-progress and acknowledgement views need. Read with the admin's own
 * RLS client (admins can read all rows), so RLS stays a second check inside /admin.
 */
export async function loadProgressInput(now = new Date()): Promise<ProgressInput> {
  const supabase = await createClient();
  const [profiles, categories, challenges, submissions, acknowledgements] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,track").order("full_name", { nullsFirst: false }),
    supabase.from("categories").select("slug,archived,audiences"),
    supabase
      .from("challenges")
      .select("slug,title,category_slug,type,status,audiences,required_for,due_at")
      .eq("status", "published")
      .order("title"),
    supabase.from("submissions").select("user_id,challenge_slug,attempt,status,final_score,max_score,published_at").eq("is_test", false),
    supabase.from("acknowledgements").select("user_id,challenge_slug,acknowledged_at,challenge_version"),
  ]);
  for (const res of [profiles, categories, challenges, submissions, acknowledgements]) {
    if (res.error) throw new Error(`Couldn't load progress: ${res.error.message}`);
  }
  return {
    profiles: profiles.data ?? [],
    categories: categories.data ?? [],
    challenges: challenges.data ?? [],
    submissions: submissions.data ?? [],
    acknowledgements: acknowledgements.data ?? [],
    now,
  };
}
