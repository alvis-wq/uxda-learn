import "server-only";
import { joinQuiz, type QuizDraft } from "@/lib/academy/quiz";
import type { AcademyResourceRow } from "@/lib/academy/resources";
import { requireAcademyEditor } from "@/lib/auth/academy-editor";
import { allRows } from "@/lib/supabase/all-rows";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ManagedResource = Pick<
  AcademyResourceRow,
  "id" | "kind" | "title" | "url" | "status" | "quiz_reviewed" | "blog_id" | "image_path" | "sort_key" | "updated_at"
> & { hasQuiz: boolean; completions: number };

/**
 * Everything for the Academy management list: every resource (drafts and archived too, which RLS shows editors and
 * admins) with how many people completed it. Completion counts need the service role (editors can't read others'
 * completions), so the role is checked first.
 */
export async function loadManagedResources(): Promise<ManagedResource[]> {
  await requireAcademyEditor();
  const supabase = await createClient();
  const admin = createAdminClient();
  const [resources, completions] = await Promise.all([
    supabase.from("academy_resources").select("id,kind,title,url,status,quiz_reviewed,blog_id,image_path,sort_key,updated_at,questions"),
    // Every completion (well past the 1,000-row page), counted per resource below.
    allRows((from, to) => admin.from("academy_completions").select("resource_id").order("user_id").order("resource_id").range(from, to)),
  ]);
  if (resources.error) throw new Error(`Couldn't load the Academy: ${resources.error.message}`);
  if (completions.error) throw new Error(`Couldn't load completions: ${completions.error.message}`);
  const counts = new Map<string, number>();
  for (const c of completions.data ?? []) counts.set(c.resource_id, (counts.get(c.resource_id) ?? 0) + 1);
  return (resources.data ?? []).map(({ questions, ...r }) => ({
    ...r,
    hasQuiz: Array.isArray(questions) && questions.length === 5,
    completions: counts.get(r.id) ?? 0,
  }));
}

export type ResourceForEditing = AcademyResourceRow & { quiz: QuizDraft | null; completions: number; attempts: number };

/** One resource with its quiz put back together (answers included: editors and admins only). */
export async function loadResourceForEditing(id: string): Promise<ResourceForEditing | null> {
  await requireAcademyEditor();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();
  const [resource, key, completions, attempts] = await Promise.all([
    admin.from("academy_resources").select("*").eq("id", id).maybeSingle(),
    admin.from("academy_quiz_keys").select("answer_key").eq("resource_id", id).maybeSingle(),
    admin.from("academy_completions").select("user_id", { count: "exact", head: true }).eq("resource_id", id),
    admin.from("academy_quiz_attempts").select("id", { count: "exact", head: true }).eq("resource_id", id),
  ]);
  if (resource.error) throw new Error(`Couldn't load it: ${resource.error.message}`);
  if (!resource.data) return null;
  return {
    ...resource.data,
    quiz: joinQuiz(resource.data.questions, key.data?.answer_key),
    completions: completions.count ?? 0,
    attempts: attempts.count ?? 0,
  };
}

/** Blog posts a podcast episode can be linked to: those without an episode, plus `keep` (the current link). */
export async function loadBlogOptions(keep: string | null = null): Promise<{ id: string; title: string }[]> {
  await requireAcademyEditor();
  const { data, error } = await createAdminClient()
    .from("academy_resources")
    .select("id,title,sort_key,status")
    .eq("kind", "blog")
    .neq("status", "archived")
    .order("sort_key", { ascending: false });
  if (error) throw new Error(`Couldn't load blog posts: ${error.message}`);
  const { data: linked } = await createAdminClient().from("academy_resources").select("blog_id").not("blog_id", "is", null);
  const taken = new Set((linked ?? []).map((l) => l.blog_id).filter((b) => b !== keep));
  return (data ?? []).filter((b) => !taken.has(b.id)).map((b) => ({ id: b.id, title: b.title }));
}
