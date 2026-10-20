"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Uses the user's own RLS client: `authenticated` may only UPDATE show_on_leaderboard,
 * and the policy limits it to their own row — no service role needed.
 */
export async function setLeaderboardVisibility(visible: boolean): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  const parsed = z.boolean().safeParse(visible);
  if (!parsed.success) return { error: "Invalid value." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ show_on_leaderboard: parsed.data })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save your preference. Please try again." };

  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  return {};
}
