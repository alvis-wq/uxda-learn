import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DIFFICULTY_LABEL, TYPE_LABEL } from "@/lib/challenges/model";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Content · Admin · UXDA Learn" };

const STATUS_VARIANT = { published: "default", draft: "secondary", archived: "outline" } as const;

export default async function AdminContentPage() {
  const supabase = await createClient();
  const [{ data: categories, error }, { data: challenges }, { data: subs }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("challenges")
      .select("slug,category_slug,title,type,audience,difficulty,points,status,version,updated_at")
      .order("title"),
    supabase.from("submissions").select("challenge_slug"),
  ]);
  if (error) throw new Error(`Couldn't load content: ${error.message}`);
  const count = (slug: string) => (subs ?? []).filter((s) => s.challenge_slug === slug).length;

  return (
    <section aria-labelledby="content-heading" className="grid gap-8">
      <div>
        <h1 id="content-heading" className="text-2xl font-semibold tracking-tight">
          Content
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only. Edit files in <code>/content</code>, then run <code>npm run content:sync</code>.
        </p>
      </div>
      {categories.length === 0 && <EmptyState icon={FileText} title="No content synced yet" />}
      {categories.map((cat) => {
        const list = (challenges ?? []).filter((c) => c.category_slug === cat.slug);
        return (
          <div key={cat.slug} className="grid gap-2">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              {cat.title}
              <Badge variant="outline" className="capitalize">
                {cat.audience}
              </Badge>
              {cat.archived && <Badge variant="secondary">Archived</Badge>}
            </h2>
            {list.length === 0 ? (
              <p className="text-muted-foreground text-sm">No challenges.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Challenge</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right">Version</TableHead>
                      <TableHead className="text-right">Submissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((c) => (
                      <TableRow key={c.slug}>
                        <TableCell>
                          <Link href={`/challenges/${c.slug}`} className="font-medium hover:underline">
                            {c.title}
                          </Link>
                          <div className="text-muted-foreground text-xs">{c.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status as keyof typeof STATUS_VARIANT] ?? "outline"} className="capitalize">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{TYPE_LABEL[c.type]}</TableCell>
                        <TableCell className="capitalize">{c.audience}</TableCell>
                        <TableCell>{DIFFICULTY_LABEL[c.difficulty]}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.points}</TableCell>
                        <TableCell className="text-right tabular-nums">v{c.version}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(c.slug)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
