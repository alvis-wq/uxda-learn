import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AcademyItem } from "@/lib/academy/resources";

/**
 * Every published Academy resource with whether this user has completed it. Read with the user's own client: RLS
 * returns published resources (editors and admins also get drafts, so they're filtered out here) and only their own
 * completions.
 */
export async function loadAcademyItems(userId: string): Promise<AcademyItem[]> {
  const supabase = await createClient();
  const [resources, completions] = await Promise.all([
    supabase
      .from("academy_resources")
      .select("id,kind,title,url,description,image_path,author,category,blog_id,sort_key")
      .eq("status", "published"),
    supabase.from("academy_completions").select("resource_id").eq("user_id", userId),
  ]);
  if (resources.error) throw new Error(`Couldn't load the Academy: ${resources.error.message}`);
  if (completions.error) throw new Error(`Couldn't load your Academy progress: ${completions.error.message}`);
  const done = new Set((completions.data ?? []).map((c) => c.resource_id));
  return (resources.data ?? []).map((r) => ({ ...r, done: done.has(r.id) }));
}
