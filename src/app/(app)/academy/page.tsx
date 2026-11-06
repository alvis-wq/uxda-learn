import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BookMarked, BookOpen, Headphones, Newspaper, Search, Settings2, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOOK_CATEGORY_LABEL,
  BOOK_FILTER_LABEL,
  BOOK_FILTERS,
  counterparts,
  filterBooks,
  filterItems,
  groupBooks,
  listOf,
  parseBookFilter,
  parseShowFilter,
  progressByKind,
  searchItems,
  SHOW_FILTERS,
  SHOW_LABEL,
  type AcademyItem,
  type BookFilter,
  type ShowFilter,
} from "@/lib/academy/resources";
import { canEditAcademy } from "@/lib/auth/roles";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { loadAcademyItems } from "@/lib/data/academy";
import { cn } from "@/lib/utils";
import { BookCard, ResourceRowItem } from "./academy-items";

export const metadata: Metadata = { title: "Academy · UXDA Learn" };

const TABS = [
  { id: "blog", label: "Blog", icon: Newspaper },
  { id: "podcasts", label: "Podcasts", icon: Headphones },
  { id: "books", label: "Books", icon: BookOpen },
] as const;
type Tab = (typeof TABS)[number]["id"];

function parseTab(value: unknown): Tab {
  return TABS.some((t) => t.id === value) ? (value as Tab) : "blog";
}

function href(tab: Tab, show: string, q: string) {
  const p = new URLSearchParams();
  if (tab !== "blog") p.set("tab", tab);
  if (show !== "all") p.set("show", show);
  if (q) p.set("q", q);
  const s = p.toString();
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

/** Search within the current tab: a plain GET form, so the search lives in the URL like the tabs and filters. */
function SearchBox({ tab, show, q }: { tab: Tab; show: string; q: string }) {
  const what = tab === "books" ? "books" : tab === "podcasts" ? "episodes" : "posts";
  return (
    <Form action="/academy" role="search" className="relative w-full sm:w-64">
      {tab !== "blog" && <input type="hidden" name="tab" value={tab} />}
      {show !== "all" && <input type="hidden" name="show" value={show} />}
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
      <Input
        type="search"
        name="q"
        defaultValue={q}
        key={`${tab}-${q}`}
        placeholder={`Search ${what}`}
        aria-label={`Search ${what}`}
        maxLength={100}
        className="rounded-full pr-9 pl-9"
      />
      {q && (
        <Link
          href={href(tab, show, "")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          aria-label="Clear the search"
        >
          <X className="size-4" aria-hidden />
        </Link>
      )}
    </Form>
  );
}

function BookGrid({ books, testId = "book-grid" }: { books: AcademyItem[]; testId?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {books.map((b) => (
        <BookCard key={b.id} item={b} />
      ))}
    </div>
  );
}

const SHOW_EMPTY: Record<"blog" | "podcasts", Record<ShowFilter, [string, string]>> = {
  blog: {
    all: ["No blog posts yet", "New ones appear here as soon as they're added."],
    done: ["No posts done yet", "Pass a post's quick check and it shows up here."],
    todo: ["All posts done", "You've read every post. Nice."],
  },
  podcasts: {
    all: ["No podcast episodes yet", "New ones appear here as soon as they're added."],
    done: ["No episodes done yet", "Listened to one? Switch it to done and it shows up here."],
    todo: ["All episodes done", "You've listened to every episode. Nice."],
  },
};

const BOOK_EMPTY: Record<BookFilter, [string, string]> = {
  all: ["No books yet", "New ones appear here as soon as they're added."],
  reading: ["Not reading anything right now", "Pick a book and press Reading now: it shows up here."],
  unread: ["No books left to start", "You're reading or have finished every book on the list."],
  done: ["No books done yet", "Pass a book's quick check and it shows up here."],
};

export default async function AcademyPage({ searchParams }: PageProps<"/academy">) {
  const profile = await requireOnboardedProfile();
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const showFilter = parseShowFilter(params.show);
  const bookFilter = parseBookFilter(params.show);
  const show: string = tab === "books" ? bookFilter : showFilter;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const items = await loadAcademyItems(profile.id);
  const progress = progressByKind(items);
  const manageHref = profile.is_admin ? "/admin/academy" : "/academy/manage";
  const pairs = counterparts(items);

  const kind = tab === "books" ? "book" : tab === "podcasts" ? "podcast" : "blog";
  const tabHasItems = progress[kind].total > 0;
  const list = tab === "books" ? [] : searchItems(filterItems(listOf(items, kind === "podcast" ? "podcast" : "blog"), showFilter), q);
  const books = searchItems(
    items.filter((i) => i.kind === "book"),
    q,
  );
  // On "All", books being read sit in their own strip at the top instead of in their group.
  const readingNow = tab === "books" && bookFilter === "all" ? filterBooks(books, "reading") : [];
  const bookGroups = groupBooks(filterBooks(books, bookFilter).filter((b) => !readingNow.includes(b)));
  const shown = tab === "books" ? readingNow.length + bookGroups.length : list.length;
  const tabIcon = TABS.find((t) => t.id === tab)!.icon;

  const filterItemsNav =
    tab === "books"
      ? BOOK_FILTERS.map((f) => ({ key: f, label: BOOK_FILTER_LABEL[f], href: href(tab, f, q), current: f === bookFilter }))
      : SHOW_FILTERS.map((f) => ({ key: f, label: SHOW_LABEL[f], href: href(tab, f, q), current: f === showFilter }));

  const nothingYet = tab === "books" ? BOOK_EMPTY.all : SHOW_EMPTY[tab].all;
  const [emptyTitle, emptyText] = q
    ? [`Nothing matches “${q}”`, "Try another word, or clear the search."]
    : tab === "books"
      ? BOOK_EMPTY[bookFilter]
      : SHOW_EMPTY[tab][showFilter];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <PageHeader
        title="UXDA Academy"
        description="Our blog posts, podcast episodes and books. Read a post or book, then pass a quick 5-question check to mark it done. Listened to an episode? Just switch it to done. Started a book? Mark it Reading now."
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
        ).map(([k, label, Icon]) => (
          <div key={k} className="bg-card rounded-xl border p-3">
            <dt className="text-meta text-muted-foreground flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {progress[k].done}
              <span className="text-muted-foreground text-sm font-normal"> / {progress[k].total}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PillNav
          label="Academy sections"
          items={TABS.map((t) => ({ key: t.id, label: t.label, href: href(t.id, "all", ""), current: t.id === tab }))}
        />
        <SearchBox tab={tab} show={show} q={q} />
      </div>
      <div className="mb-6">
        <PillNav label="Show" items={filterItemsNav} />
      </div>

      {!tabHasItems ? (
        <EmptyState icon={tabIcon} title={nothingYet[0]} description={nothingYet[1]} />
      ) : shown === 0 ? (
        <EmptyState icon={q ? Search : tabIcon} title={emptyTitle} description={emptyText}>
          {q && (
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={href(tab, show, "")}>Clear the search</Link>
            </Button>
          )}
        </EmptyState>
      ) : tab !== "books" ? (
        <section
          aria-label={tab === "podcasts" ? "Podcast episodes" : "Blog posts"}
          className="grid gap-3 md:grid-cols-2"
          data-testid={tab === "podcasts" ? "podcast-list" : "blog-list"}
        >
          {list.map((i) => (
            <ResourceRowItem key={i.id} item={i} counterpart={pairs.get(i.id)} />
          ))}
        </section>
      ) : (
        <div className="grid gap-10">
          {readingNow.length > 0 && (
            <section aria-labelledby="books-reading" className="bg-accent/40 grid gap-4 rounded-2xl border p-4" data-testid="reading-now">
              <h2 id="books-reading" className="text-meta flex items-center gap-1.5 font-bold">
                <BookMarked className="size-4" aria-hidden />
                Reading now
              </h2>
              <BookGrid books={readingNow} testId="reading-grid" />
            </section>
          )}
          {bookGroups.map((g) => (
            <section key={g.category} aria-labelledby={`books-${g.category}`} className="grid gap-4">
              <h2 id={`books-${g.category}`} className="text-meta font-bold">
                {BOOK_CATEGORY_LABEL[g.category]}
              </h2>
              <BookGrid books={g.books} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
