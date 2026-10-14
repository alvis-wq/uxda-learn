import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Route } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getUserPathProgress } from "@/lib/data/admin-path-progress";
import { MILESTONE_STATUS_LABEL, pathProgressLine } from "@/lib/paths/progress";
import { TRACK_LABEL, type Track } from "@/lib/tracks";
import { formatDateTime } from "@/lib/utils";
import { ImportForm, UndoImportButton } from "./import-controls";

export const metadata: Metadata = { title: "User · Admin · UXDA Learn" };

/**
 * One user, for admins: their progress through each learning path, with "Import…" to record progress made before
 * UXDA Learn (done with a score, or changes requested with feedback) and "Undo import" for the latest imported
 * attempt. Every import and undo is in the history at the bottom.
 */
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getUserPathProgress(id);
  if (!data) notFound();
  const { profile, paths, history } = data;
  const name = profile.full_name ?? profile.email;

  return (
    <section aria-labelledby="user-heading" className="grid gap-8">
      <div>
        <Link href="/admin/users" className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="size-4" aria-hidden />
          Users
        </Link>
        <h1 id="user-heading" className="text-2xl font-semibold tracking-tight">
          {name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {profile.email} · {profile.track ? TRACK_LABEL[profile.track as Track] : "No track yet"}
        </p>
      </div>

      <section aria-labelledby="path-progress-heading" className="grid gap-4">
        <div>
          <h2 id="path-progress-heading" className="text-lg font-semibold">
            Path progress
          </h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Record work done before UXDA Learn. An import is a normal attempt (it uses one of the 3), so points, the leaderboard
            and the profile count it at once. The note is shown to the learner as feedback.
          </p>
        </div>
        {paths.length === 0 ? (
          <EmptyState icon={Route} title="No paths for this user" description="Paths their track can see will show up here." />
        ) : (
          paths.map((p) => (
            <Card key={p.slug} className="gap-4 py-4" data-testid="user-path" data-slug={p.slug}>
              <CardHeader className="grid gap-2 px-4">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {p.title}
                  {p.status !== "published" && <Badge variant="outline">{p.status === "draft" ? "Draft" : p.status}</Badge>}
                </CardTitle>
                <p className="text-muted-foreground text-meta tabular-nums">{pathProgressLine(p.summary)}</p>
                <Progress
                  value={p.summary.total ? Math.round((p.summary.done / p.summary.total) * 100) : 0}
                  aria-label={`${p.title}: ${p.summary.done} of ${p.summary.total} done`}
                />
              </CardHeader>
              <CardContent className="px-4">
                <ol className="divide-y">
                  {p.milestones.map((m) => (
                    <li key={m.slug} className="grid gap-2 py-3" data-testid="user-milestone" data-slug={m.slug}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="min-w-0 font-medium">
                          <span className="text-muted-foreground tabular-nums">{m.state.position}.</span> {m.title}
                        </p>
                        <p className="text-meta flex flex-wrap items-center gap-x-3 tabular-nums">
                          <span data-testid="user-milestone-status">{MILESTONE_STATUS_LABEL[m.state.status]}</span>
                          <span>{m.state.bestScore !== null ? `${m.state.bestScore} / ${m.points}` : `– / ${m.points}`} pts</span>
                          <span className="text-muted-foreground">{m.attemptsUsed} of 3 attempts</span>
                        </p>
                      </div>
                      {m.imports.map((imp) => (
                        <div key={imp.id} className="text-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Badge variant="outline">Imported</Badge>
                          <span>
                            Attempt {imp.attempt}: {imp.status === "published" ? "done" : "changes requested"}, {imp.final_score}/{m.points}
                            {imp.feedback ? ` — “${imp.feedback}”` : ""}
                          </span>
                          {imp.undoable && <UndoImportButton submissionId={imp.id} label={`${m.title} for ${name}`} />}
                        </div>
                      ))}
                      {m.blocker ? (
                        <p className="text-muted-foreground text-meta">{m.blocker}</p>
                      ) : (
                        <ImportForm userId={profile.id} userName={name} slug={m.slug} title={m.title} points={m.points} />
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section aria-labelledby="import-history-heading" className="grid gap-3">
        <h2 id="import-history-heading" className="text-lg font-semibold">
          Import history
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing imported for this user.</p>
        ) : (
          <ol className="grid gap-1.5 border-l pl-4 text-sm" data-testid="import-history">
            {history.map((h) => (
              <li key={h.id} className="grid gap-0.5">
                <span>
                  {h.action === "import" ? "Imported" : "Undid import of"} {h.challenge_slug}:{" "}
                  {h.status === "published" ? "done" : "changes requested"}, {h.final_score}/{h.max_score}
                </span>
                <span className="text-muted-foreground text-meta">
                  {h.who} · <time dateTime={h.changed_at}>{formatDateTime(h.changed_at)}</time>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
