import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { summarizeScores } from "@/lib/submissions/rules";

/** CSV of every user's scores: totals plus best published score per challenge. Admins only. */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const [{ data: profiles, error: pErr }, { data: subs, error: sErr }, { data: challenges }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,track,show_on_leaderboard").order("full_name"),
    supabase.from("submissions").select("user_id,challenge_slug,status,final_score").eq("is_test", false),
    supabase.from("challenges").select("slug").neq("status", "draft").order("slug"),
  ]);
  if (pErr || sErr) return new NextResponse("Couldn't load scores", { status: 500 });

  const slugs = (challenges ?? []).map((c) => c.slug);
  const header = ["name", "email", "track", "total_score", "completed", "pending_reviews", "on_leaderboard", ...slugs];
  const rows = profiles.map((p) => {
    const mine = subs.filter((s) => s.user_id === p.id);
    const totals = summarizeScores(mine);
    const best = (slug: string) => {
      const scores = mine
        .filter((s) => s.challenge_slug === slug && s.status === "published" && s.final_score !== null)
        .map((s) => Number(s.final_score));
      return scores.length ? Math.max(...scores) : "";
    };
    return [
      p.full_name ?? "",
      p.email,
      p.track ?? "",
      totals.totalScore,
      totals.completed,
      totals.pending,
      p.show_on_leaderboard ? "yes" : "no",
      ...slugs.map(best),
    ];
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uxda-learn-scores-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
