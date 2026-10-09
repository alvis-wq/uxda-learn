"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRACK_VALUES } from "@/lib/tracks";

export type OnboardingState = { error?: string };

const schema = z.object({ track: z.enum(TRACK_VALUES) });

/** Set the signed-in user's track. Only allowed while it's still empty; admins change it later. */
export async function chooseTrack(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse({ track: formData.get("track") });
  if (!parsed.success) return { error: "Choose your track." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ track: parsed.data.track })
    .eq("id", user.id)
    .is("track", null)
    .select("id");
  if (error) return { error: "Couldn't save your choice. Please try again." };
  if (!data?.length) {
    return { error: "Your track is already set. Ask an admin if it needs to change." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
