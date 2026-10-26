import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Headphones, Newspaper, Settings2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  BOOK_CATEGORY_LABEL,
  filterItems,
  filterRows,
  groupBooks,
  pairBlogsAndPodcasts,
  parseShowFilter,
  progressByKind,
  SHOW_FILTERS,
  SHOW_LABEL,
  type ShowFilter,
} from "@/lib/academy/resources";
import { canEditAcademy } from "@/lib/auth/roles";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { loadAcademyItems } from "@/lib/data/academy";
import { cn } from "@/lib/utils";
import { BookCard, PodcastPlaceholder, ResourceRowItem } from "./academy-items";

export const metadata: Metadata = { title: "Academy · UXDA Learn" };

const TABS = [
  { id: "blog", label: "Blog & Pod" },
  { id: "books", label: "Books" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function href(tab: Tab, show: ShowFilter) {
  const q = new URLSearchParams();
  if (tab !== "blog") q.set("tab", tab);
  if (show !== "all") q.set("show", show);
  const s = q.toString();
  return s ? `/academy?${s}` : "/academy";
}

/** Pills like the leaderboard's groups: links, so the choice lives in the URL (reload, back, share). */
function PillNav({ label, items }: { label: string; items: { key: string; label: string; href: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="bg-muted inline-flex max-w-full flex-wrap rounded-full p-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.current ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            i.current ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function AcademyPage({ searchParams }: PageProps<"/academy">) {
  const profile = await requireOnboardedProfile();
  const params = await searchParams;
  const tab: Tab = params.tab === "books" ? "books" : "blog";
  const show = parseShowFilter(params.show);
  const items = await loadAcademyItems(profile.id);
  const progress = progressByKind(items);
  const manageHref = profile.is_admin ? "/admin/academy" : "/academy/manage";

  const rows = filterRows(pairBlogsAndPodcasts(items), show);
  const bookGroups = groupBooks(filterItems(items, show));
  const tabHasItems = tab === "blog" ? progress.blog.total + progress.podcast.total > 0 : progress.book.total > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <PageHeader
        title="UXDA Academy"
        description="Our blog posts, podcast episodes and books. Read or listen, then pass a quick 5-question check to mark it done."
      >
        {canEditAcademy(profile) && (
          <Button asChild variant="outline" size="sm">
            <Link href={manageHref}>
              <Settings2 aria-hidden />
              Manage Academy
            </Link>
          </Button>
        )}
      </PageHeader>

      <dl className="mb-6 grid grid-cols-3 gap-3 sm:max-w-xl" data-testid="academy-progress">
        {(
          [
            ["blog", "Blog posts", Newspaper],
            ["podcast", "Podcasts", Headphones],
            ["book", "Books", BookOpen],
          ] as const
        ).map(([kind, label, Icon]) => (
          <div key={kind} className="bg-card rounded-xl border p-3">
            <dt className="text-meta text-muted-foreground flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {progress[kind].done}
              <span className="text-muted-foreground text-sm font-normal"> / {progress[kind].total}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PillNav
          label="Academy sections"
          items={TABS.map((t) => ({ key: t.id, label: t.label, href: href(t.id, show), current: t.id === tab }))}
        />
        <PillNav
          label="Show"
          items={SHOW_FILTERS.map((f) => ({ key: f, label: SHOW_LABEL[f], href: href(tab, f), current: f === show }))}
        />
      </div>

      {!tabHasItems ? (
        <EmptyState
          icon={tab === "blog" ? Newspaper : BookOpen}
          title={tab === "blog" ? "No blog posts or podcasts yet" : "No books yet"}
          description="New ones appear here as soon as they're added."
        />
      ) : tab === "blog" ? (
        rows.length === 0 ? (
          <EmptyState title={show === "done" ? "Nothing done yet" : "All done here"} description={show === "done" ? "Mark a post or episode done and it shows up here." : "You've finished every post and episode. Nice."} />
        ) : (
          <section aria-label="Blog posts and podcast episodes" className="grid gap-3" data-testid="blog-pod-list">
            <div className="text-meta text-muted-foreground hidden grid-cols-2 gap-3 font-bold md:grid" aria-hidden>
              <span>Blog posts</span>
              <span>Podcast episodes</span>
            </div>
            {rows.map((r) => (
              <div key={r.blog?.id ?? r.podcast!.id} className="grid gap-3 md:grid-cols-2" data-testid="blog-pod-row">
                {r.blog ? <ResourceRowItem item={r.blog} /> : <div className="hidden md:block" />}
                {r.podcast ? <ResourceRowItem item={r.podcast} /> : show === "all" && r.blog ? <PodcastPlaceholder /> : <div className="hidden md:block" />}
              </div>
            ))}
          </section>
        )
      ) : bookGroups.length === 0 ? (
        <EmptyState title={show === "done" ? "No books done yet" : "All books done"} description={show === "done" ? "Mark a book done and it shows up here." : "You've read every book on the list. Impressive."} />
      ) : (
        <div className="grid gap-10">
          {bookGroups.map((g) => (
            <section key={g.category} aria-labelledby={`books-${g.category}`} className="grid gap-4">
              <h2 id={`books-${g.category}`} className="text-meta font-bold">
                {BOOK_CATEGORY_LABEL[g.category]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="book-grid">
                {g.books.map((b) => (
                  <BookCard key={b.id} item={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
