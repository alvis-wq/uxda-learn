import type { Metadata } from "next";
import { CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { REVIEWABLE_STATUSES, sortQueue } from "@/lib/admin/review";
import { createClient } from "@/lib/supabase/server";
import { TRACK_LABEL } from "@/lib/tracks";
import { QueueTable } from "./queue-table";

export const metadata: Metadata = { title: "Review queue · Admin · UXDA Learn" };

export default async function ReviewQueuePage() {
  // Admin RLS lets the admin's own client read every submission and evaluation.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id,status,attempt,submitted_at,edited_at,auto_score,final_score,max_score,profiles!submissions_user_id_fkey(full_name,email,track),challenges(title),evaluations(confidence,flags,created_at)",
    )
    .in("status", [...REVIEWABLE_STATUSES])
    .eq("is_test", false); // a test attempt is never reviewed
  if (error) throw new Error(`Couldn't load the review queue: ${error.message}`);

  const items = sortQueue(
    data.map((s) => {
      const latest = [...s.evaluations].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return { ...s, confidence: latest?.confidence ?? null, flags: latest?.flags ?? [] };
    }),
  );

  return (
    <section aria-labelledby="queue-heading">
      <h1 id="queue-heading" className="mb-1 text-2xl font-semibold tracking-tight">
        Review queue
      </h1>
      <p className="text-muted-foreground mb-6 text-sm">
        AI-reviewed submissions first; low confidence and flagged items need the closest look. Tick AI-reviewed ones to
        approve them together with the AI score and feedback.
      </p>
      {items.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Nothing to review" description="New submissions appear here." />
      ) : (
        <QueueTable
          rows={items.map((s) => ({
            id: s.id,
            learner: s.profiles?.full_name ?? s.profiles?.email ?? "Unknown",
            track: s.profiles?.track ? TRACK_LABEL[s.profiles.track] : "No track",
            challenge: s.challenges?.title ?? "",
            attempt: s.attempt,
            status: s.status,
            confidence: s.confidence,
            flags: s.flags,
            score: `${s.final_score ?? s.auto_score} / ${s.max_score}`,
            submitted: new Date(s.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
            edited: s.edited_at !== null,
          }))}
        />
      )}
    </section>
  );
}
