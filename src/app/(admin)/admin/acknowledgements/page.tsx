import type { Metadata } from "next";
import Link from "next/link";
import { BookCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RequiredBadges } from "@/components/required-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAcknowledgementOverview } from "@/lib/admin/required-progress";
import { loadProgressInput } from "@/lib/data/admin-progress";
import { audienceLabel, TRACK_LABEL, type Track } from "@/lib/tracks";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Acknowledgements · Admin · UXDA Learn" };

export default async function AdminAcknowledgementsPage() {
  const now = new Date();
  const overview = buildAcknowledgementOverview(await loadProgressInput(now));

  return (
    <section aria-labelledby="acks-heading" className="grid gap-6">
      <div>
        <h1 id="acks-heading" className="text-2xl font-semibold tracking-tight">
          Acknowledgements
        </h1>
        <p className="text-muted-foreground mt-1">
          Who has confirmed each &ldquo;read and understood&rdquo; challenge, and who hasn&apos;t yet.
        </p>
      </div>

      {overview.length === 0 ? (
        <EmptyState
          icon={BookCheck}
          title="No acknowledge challenges published"
          description="Create one with type: acknowledge (see docs/content-format.md)."
        />
      ) : (
        overview.map(({ challenge, acknowledged, missing }) => {
          const total = acknowledged.length + missing.length;
          return (
            <Card key={challenge.slug} data-testid={`ack-card-${challenge.slug}`}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/challenges/${challenge.slug}`} className="hover:underline">
                    {challenge.title}
                  </Link>
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span className="text-meta">
                    {acknowledged.length} of {total} confirmed · for {audienceLabel(challenge.audiences)}
                  </span>
                  <RequiredBadges
                    required={challenge.required_for.length > 0}
                    dueAt={challenge.due_at}
                    done={missing.length === 0}
                    now={now}
                  />
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="grid content-start gap-2">
                  <h2 className="text-meta font-medium">Not yet confirmed ({missing.length})</h2>
                  {missing.length === 0 ? (
                    <p className="text-muted-foreground">Everyone has confirmed.</p>
                  ) : (
                    <ul className="grid gap-1.5" data-testid="ack-missing">
                      {missing.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3">
                          <span className="min-w-0">{p.full_name ?? p.email}</span>
                          <Badge variant="outline">{TRACK_LABEL[p.track as Track]}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid content-start gap-2">
                  <h2 className="text-meta font-medium">Confirmed ({acknowledged.length})</h2>
                  {acknowledged.length === 0 ? (
                    <p className="text-muted-foreground">No one yet.</p>
                  ) : (
                    <ul className="grid gap-1.5" data-testid="ack-done">
                      {acknowledged.map(({ user, at, version }) => (
                        <li key={user.id} className="flex flex-wrap items-center justify-between gap-x-3">
                          <span className="min-w-0">{user.full_name ?? user.email}</span>
                          <span className="text-muted-foreground text-meta">
                            {formatDateTime(at)} · v{version}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
