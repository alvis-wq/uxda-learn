import type { Metadata } from "next";
import { GraduationCap, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KIND_LABEL } from "@/lib/academy/resources";
import { loadTeamAcademyInput } from "@/lib/data/team-progress";
import { buildTeamAcademy } from "@/lib/team/academy";
import { TeamSections } from "../team-sections";

export const metadata: Metadata = { title: "Academy progress · Team · UXDA Learn" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Academy progress, for leads and admins: who has completed how many blog posts, podcasts and books, and who did which. */
export default async function TeamAcademyPage() {
  const { people, byResource, totals } = buildTeamAcademy(await loadTeamAcademyInput());

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <PageHeader title="Team progress" description="Academy: blog posts, podcast episodes and books completed (quiz passed, or carried over from the old spreadsheet)." />
      <TeamSections current="academy" />

      {people.length === 0 ? (
        <EmptyState icon={Users} title="No one has joined yet" />
      ) : byResource.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nothing published in the Academy yet" />
      ) : (
        <div className="grid gap-10">
          <section aria-labelledby="people-heading" className="grid gap-3">
            <h2 id="people-heading" className="text-lg font-semibold">
              People
            </h2>
            <div className="overflow-x-auto">
              <Table data-testid="team-academy-people">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Blog posts</TableHead>
                    <TableHead className="text-right">Podcasts</TableHead>
                    <TableHead className="text-right">Books</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Last completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      {(["blog", "podcast", "book"] as const).map((k) => (
                        <TableCell key={k} className="text-right tabular-nums">
                          {p.done[k]}
                          <span className="text-muted-foreground"> / {totals[k]}</span>
                        </TableCell>
                      ))}
                      <TableCell className="text-muted-foreground hidden text-right text-sm sm:table-cell">{p.last ? dateFmt.format(new Date(p.last)) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section aria-labelledby="resources-heading" className="grid gap-3">
            <h2 id="resources-heading" className="text-lg font-semibold">
              By resource
            </h2>
            <ul className="divide-y rounded-xl border" data-testid="team-academy-resources">
              {byResource.map((r) => (
                <li key={r.id}>
                  <details className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="text-muted-foreground text-meta mr-2">{KIND_LABEL[r.kind]}</span>
                        {r.title}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {r.doneBy.length} / {people.length}
                      </span>
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm">{r.doneBy.length ? r.doneBy.join(", ") : "No one yet."}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
