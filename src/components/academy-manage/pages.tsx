import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Headphones, Newspaper, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BOOK_CATEGORY_LABEL, KIND_LABEL, RESOURCE_KINDS, academyImageUrl, type ResourceKind } from "@/lib/academy/resources";
import { loadBlogOptions, loadManagedResources, loadResourceForEditing, type ManagedResource } from "@/lib/data/academy-manage";
import { cn } from "@/lib/utils";
import { QuizEditor } from "./quiz-editor";
import { ResourceForm } from "./resource-form";
import { StatusControls } from "./status-controls";

/**
 * Academy management, shared by Admin → Academy (/admin/academy) and /academy/manage (Academy editors who aren't
 * admins). `base` is where the pages live; each data loader checks the role itself.
 */

const KIND_ICON = { blog: Newspaper, podcast: Headphones, book: BookOpen } as const;
const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

type ListFilters = { kind?: string; status?: string; review?: string };

function listHref(base: string, f: ListFilters) {
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `${base}?${q}` : base;
}

function FilterLinks({ base, filters, field, options }: { base: string; filters: ListFilters; field: keyof ListFilters; options: [string | undefined, string][] }) {
  return (
    <nav aria-label={`Filter by ${field}`} className="bg-muted inline-flex flex-wrap rounded-full p-1">
      {options.map(([value, label]) => {
        const current = (filters[field] ?? undefined) === value;
        return (
          <Link
            key={label}
            href={listHref(base, { ...filters, [field]: value })}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              current ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export async function AcademyManageList({ base, filters }: { base: string; filters: ListFilters }) {
  const all = await loadManagedResources();
  const kind = RESOURCE_KINDS.includes(filters.kind as ResourceKind) ? filters.kind : undefined;
  const status = ["draft", "published", "archived"].includes(filters.status ?? "") ? filters.status : undefined;
  const review = filters.review === "todo" ? "todo" : undefined;
  const f = { kind, status, review };
  const shown = all
    .filter((r) => (!kind || r.kind === kind) && (!status || r.status === status) && (!review || (r.hasQuiz && !r.quiz_reviewed) || !r.hasQuiz))
    .sort((a, b) => b.sort_key - a.sort_key || a.title.localeCompare(b.title));
  const toReview = all.filter((r) => r.status !== "archived" && (!r.hasQuiz || !r.quiz_reviewed)).length;
  const blogTitles = new Map(all.filter((r) => r.kind === "blog").map((r) => [r.id, r.title]));

  return (
    <section aria-labelledby="academy-manage-heading" className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="academy-manage-heading" className="text-2xl font-semibold tracking-tight">
            Academy
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Blog posts, podcast episodes and books, with their quizzes. Add one from its link: the details are read
            from the page, and Claude drafts the quiz for you to check. {toReview > 0 && <strong>{toReview} quizzes to check.</strong>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RESOURCE_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <Button key={k} asChild size="sm" variant={k === "blog" ? "default" : "outline"}>
                <Link href={`${base}/new?kind=${k}`}>
                  <Plus aria-hidden />
                  <Icon aria-hidden />
                  {KIND_LABEL[k]}
                </Link>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLinks base={base} filters={f} field="kind" options={[[undefined, "All"], ["blog", "Blog posts"], ["podcast", "Podcasts"], ["book", "Books"]]} />
        <FilterLinks base={base} filters={f} field="status" options={[[undefined, "Any status"], ["published", "Published"], ["draft", "Drafts"], ["archived", "Archived"]]} />
        <FilterLinks base={base} filters={f} field="review" options={[[undefined, "Any quiz"], ["todo", "Quiz to check"]]} />
      </div>

      {shown.length === 0 ? (
        <EmptyState title={all.length === 0 ? "Nothing in the Academy yet" : "Nothing matches these filters"} description={all.length === 0 ? "Add the first blog post, podcast episode or book." : undefined} />
      ) : (
        <div className="overflow-x-auto">
          <Table data-testid="academy-manage-list">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quiz</TableHead>
                <TableHead className="text-right">Done by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <ManageRow key={r.id} r={r} base={base} blogTitle={r.blog_id ? blogTitles.get(r.blog_id) : undefined} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function ManageRow({ r, base, blogTitle }: { r: ManagedResource; base: string; blogTitle?: string }) {
  return (
    <TableRow data-testid="academy-manage-row" data-id={r.id}>
      <TableCell className="max-w-md">
        <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
          {r.title}
        </Link>
        {blogTitle && <p className="text-muted-foreground text-meta truncate">About: {blogTitle}</p>}
      </TableCell>
      <TableCell className="text-sm">{KIND_LABEL[r.kind as ResourceKind] ?? r.kind}</TableCell>
      <TableCell>
        <Badge variant={r.status === "published" ? "default" : r.status === "draft" ? "secondary" : "outline"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      </TableCell>
      <TableCell>
        {!r.hasQuiz ? <Badge variant="destructive">No quiz</Badge> : r.quiz_reviewed ? <Badge variant="outline">Checked</Badge> : <Badge variant="secondary">To check</Badge>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{r.completions}</TableCell>
    </TableRow>
  );
}

function BackLink({ base }: { base: string }) {
  return (
    <Link href={base} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="size-4" aria-hidden />
      All Academy resources
    </Link>
  );
}

export async function AcademyManageNew({ base, kind: kindParam }: { base: string; kind: string | undefined }) {
  const kind: ResourceKind = RESOURCE_KINDS.includes(kindParam as ResourceKind) ? (kindParam as ResourceKind) : "blog";
  const blogs = kind === "podcast" ? await loadBlogOptions() : [];
  return (
    <section aria-labelledby="new-heading" className="grid max-w-3xl gap-6">
      <BackLink base={base} />
      <h1 id="new-heading" className="text-2xl font-semibold tracking-tight">
        Add a {KIND_LABEL[kind].toLowerCase()}
      </h1>
      <ResourceForm base={base} kind={kind} blogs={blogs} />
    </section>
  );
}

export async function AcademyManageEdit({ base, id }: { base: string; id: string }) {
  const r = await loadResourceForEditing(id);
  if (!r) notFound();
  const kind = r.kind as ResourceKind;
  const blogs = kind === "podcast" ? await loadBlogOptions(r.blog_id) : [];
  return (
    <section aria-labelledby="edit-heading" className="grid max-w-3xl gap-8">
      <BackLink base={base} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-meta">
            {KIND_LABEL[kind]}
            {kind === "book" && r.category ? ` · ${BOOK_CATEGORY_LABEL[r.category as "academy" | "other"] ?? r.category}` : ""}
          </p>
          <h1 id="edit-heading" className="text-2xl font-semibold tracking-tight">
            {r.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Done by {r.completions} {r.completions === 1 ? "person" : "people"} · {r.attempts} quiz {r.attempts === 1 ? "try" : "tries"}
          </p>
        </div>
        <StatusControls base={base} id={r.id} status={r.status} hasQuiz={!!r.quiz} deletable={r.status === "draft" && r.completions === 0 && r.attempts === 0} />
      </div>

      <section aria-labelledby="quiz-heading" className="grid gap-3">
        <h2 id="quiz-heading" className="text-lg font-semibold">
          Quiz
        </h2>
        <QuizEditor id={r.id} quiz={r.quiz} reviewed={r.quiz_reviewed} />
      </section>

      <section aria-labelledby="details-heading" className="grid gap-3">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <ResourceForm
          base={base}
          kind={kind}
          blogs={blogs}
          existing={{
            id: r.id,
            title: r.title,
            url: r.url,
            description: r.description,
            author: r.author,
            category: r.category,
            blogId: r.blog_id,
            imageUrl: academyImageUrl(r.image_path),
          }}
        />
      </section>
    </section>
  );
}
