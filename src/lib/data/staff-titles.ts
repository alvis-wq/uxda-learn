import { createClient } from "@/lib/supabase/server";

/** The signed-in person's job title, or undefined when they have none (a failed lookup just shows no title). */
export async function getJobTitle(email: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_titles").select("job_title").eq("email", email.toLowerCase()).maybeSingle();
  return data?.job_title;
}
