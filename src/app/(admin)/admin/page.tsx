import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REVIEWABLE_STATUSES, sortQueue } from "@/lib/admin/review";
import { createClient } from "@/lib/supabase/server";
import { TRACK_LABEL } from "@/lib/tracks";

export const metadata: Metadata = { title: "Review queue · Admin · UXDA Learn" };

export default async function ReviewQueuePage() {
  // Admin RLS lets the admin's own client read every submission and evaluation.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id,status,attempt,submitted_at,auto_score,final_score,max_score,profiles(full_name,email,track),challenges(title),evaluations(confidence,flags,created_at)",
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
        AI-reviewed submissions first; low confidence and flagged items need the closest look.
      </p>
      {items.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Nothing to review" description="New submissions appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Challenge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>AI review</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Score</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} data-testid="queue-row">
                <TableCell>
                  <Link href={`/admin/submissions/${s.id}`} className="font-medium hover:underline">
                    {s.profiles?.full_name ?? s.profiles?.email}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {s.profiles?.track ? TRACK_LABEL[s.profiles.track] : "No track"}
                  </div>
                </TableCell>
                <TableCell>
                  {s.challenges?.title}
                  <span className="text-muted-foreground ml-1 text-xs">#{s.attempt}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "ai_reviewed" ? "default" : "outline"}>
                    {s.status === "ai_reviewed" ? "AI reviewed" : "Submitted"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.confidence === "low" && (
                      <Badge variant="destructive">
                        <AlertTriangle aria-hidden />
                        Low confidence
                      </Badge>
                    )}
                    {s.confidence && s.confidence !== "low" && (
                      <Badge variant="secondary" className="capitalize">
                        {s.confidence}
                      </Badge>
                    )}
                    {s.flags.map((f) => (
                      <Badge key={f} variant="outline">
                        {f}
                      </Badge>
                    ))}
                    {!s.confidence && <span className="text-muted-foreground text-xs">Not yet</span>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {s.final_score ?? s.auto_score} / {s.max_score}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right text-xs sm:table-cell">
                  {new Date(s.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
