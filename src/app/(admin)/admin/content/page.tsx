import type { Metadata } from "next";
import Link from "next/link";
import { Eye, FileText, Route, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIFFICULTY_LABEL, TYPE_LABEL } from "@/lib/challenges/model";
import { describePlaceholders } from "@/lib/content/placeholders";
import { getContentOverview } from "@/lib/data/admin-content";
import { audienceLabel } from "@/lib/tracks";
import { AuditHistory } from "./audit-history";
import { FeedbackList } from "./feedback-list";
import { ChallengeSettingsControls, PathSettingsControls } from "./settings-controls";

export const metadata: Metadata = { title: "Content · Admin · UXDA Learn" };

export default async function AdminContentPage() {
  const sections = await getContentOverview();

  return (
    <section aria-labelledby="content-heading" className="grid gap-8">
      <div>
        <h1 id="content-heading" className="text-2xl font-semibold tracking-tight">
          Content
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Status, required and due date are managed here and save immediately. Briefs, questions, rubrics, points
          and audiences come from <code>/content</code> — edit the files, then run <code>npm run content:sync</code>.
        </p>
      </div>
      {sections.length === 0 && <EmptyState icon={FileText} title="No content synced yet" />}
      {sections.map(({ category, challenges, paths }) => (
        <div key={category.slug} className="grid gap-3">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {category.title}
            <Badge variant="outline">{audienceLabel(category.audiences)}</Badge>
            {category.archived && <Badge variant="secondary">Archived</Badge>}
          </h2>
          {paths.length > 0 && (
            <ul className="grid gap-3">
              {paths.map((p) => (
                <li key={p.slug}>
                  <Card className="border-primary/60 gap-4 py-4" data-testid="content-path" data-slug={p.slug}>
                    <CardHeader className="flex flex-wrap items-start justify-between gap-3 px-4">
                      <div className="grid gap-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Route className="size-4" aria-hidden />
                          {p.title}
                        </CardTitle>
                        <p className="text-muted-foreground text-meta">
                          Path · {p.slug} · {audienceLabel(p.audiences)} · {p.milestones.length} milestones
                          {p.sequential ? " in order" : ""} · {p.points} pts
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/paths/${p.slug}`}>Learner view</Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4 px-4">
                      <PathSettingsControls
                        slug={p.slug}
                        title={p.title}
                        status={p.status}
                        draftMilestones={p.milestones.filter((m) => m.status === "draft").length}
                        requiredFor={p.required_for}
                        dueAt={p.due_at}
                        visibleTracks={p.visibleTracks}
                      />
                      <ol className="text-meta grid list-decimal gap-1 pl-5">
                        {p.milestones.map((m) => (
                          <li key={m.slug}>
                            {m.title} <span className="text-muted-foreground">· {m.status} · {m.points} pts</span>
                          </li>
                        ))}
                      </ol>
                      {p.placeholders.length > 0 && (
                        <p className="text-warning flex items-start gap-2 text-meta">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>Can&apos;t be published yet — placeholders to fill in: {describePlaceholders(p.placeholders)}.</span>
                        </p>
                      )}
                      <AuditHistory rows={p.history} />
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {challenges.length === 0 ? (
            <p className="text-muted-foreground text-sm">No challenges.</p>
          ) : (
            <ul className="grid gap-3">
              {challenges.map((c) => (
                <li key={c.slug}>
                  <Card className="gap-4 py-4" data-testid="content-challenge" data-slug={c.slug}>
                    <CardHeader className="flex flex-wrap items-start justify-between gap-3 px-4">
                      <div className="grid gap-1">
                        <CardTitle className="text-base">{c.title}</CardTitle>
                        {c.path && (
                          <p className="text-brand-text text-meta font-medium">
                            Milestone {c.path.position} of {c.path.total} · {c.path.title}
                          </p>
                        )}
                        <p className="text-muted-foreground text-meta">
                          {c.slug} · {TYPE_LABEL[c.type]} · {audienceLabel(c.audiences)}
                          {c.type !== "acknowledge" && ` · ${DIFFICULTY_LABEL[c.difficulty]} · ${c.points} pts`} · v
                          {c.version} · {c.submissions} {c.submissions === 1 ? "submission" : "submissions"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/content/${c.slug}`}>
                            <Eye aria-hidden />
                            Preview with answers
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/challenges/${c.slug}`}>Learner view</Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 px-4">
                      <ChallengeSettingsControls
                        slug={c.slug}
                        title={c.title}
                        status={c.status}
                        requiredFor={c.required_for}
                        dueAt={c.due_at}
                        visibleTracks={c.visibleTracks}
                        milestone={c.path !== null}
                      />
                      {c.placeholders.length > 0 && (
                        <p className="text-warning flex items-start gap-2 text-meta" data-testid="placeholder-warning">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>
                            Can&apos;t be published yet — placeholders to fill in: {describePlaceholders(c.placeholders)}.
                          </span>
                        </p>
                      )}
                      {(c.status === "draft" || c.feedback.length > 0) && <FeedbackList items={c.feedback} />}
                      <AuditHistory rows={c.history} />
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
