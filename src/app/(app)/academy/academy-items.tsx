import Image from "next/image";
import { BookOpen, ExternalLink, Headphones, Newspaper } from "lucide-react";
import { academyImageUrl, type AcademyItem } from "@/lib/academy/resources";
import { cn } from "@/lib/utils";
import { DoneSwitch } from "./quiz-dialog";

const KIND_ICON = { blog: Newspaper, podcast: Headphones, book: BookOpen } as const;

/** The resource's title as a link to it (new tab), or plain text when it has no link. */
function TitleLink({ item, className }: { item: AcademyItem; className?: string }) {
  if (!item.url) return <h3 className={className}>{item.title}</h3>;
  return (
    <h3 className={className}>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:underline">
        {item.title}
        <ExternalLink className="text-muted-foreground ml-1 inline size-3.5 align-baseline" aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </h3>
  );
}

/** Thumbnail or cover from the `academy` bucket; an icon on a tint when there is none. Decorative. */
function Thumb({ item, className, sizes }: { item: AcademyItem; className: string; sizes: string }) {
  const src = academyImageUrl(item.image_path);
  const Icon = KIND_ICON[item.kind as keyof typeof KIND_ICON] ?? Newspaper;
  return (
    <div className={cn("bg-muted relative shrink-0 overflow-hidden rounded-md", className)}>
      {src ? (
        // Public pictures in our own bucket, already small: no optimiser (it only serves local artwork, see next.config).
        <Image src={src} alt="" fill sizes={sizes} unoptimized className="object-cover" loading="lazy" />
      ) : (
        <div className="text-muted-foreground grid size-full place-items-center">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
    </div>
  );
}

/** One blog post or podcast episode in the "Blog & Pod" list: thumbnail left, text right, 150–180px tall. */
export function ResourceRowItem({ item }: { item: AcademyItem }) {
  return (
    <article
      className={cn(
        "bg-card flex gap-4 rounded-xl border p-3 sm:h-[164px]",
        item.done && "border-primary/40",
      )}
      data-testid="academy-item"
      data-kind={item.kind}
      data-done={item.done}
    >
      <Thumb item={item} className="h-24 w-24 sm:h-full sm:w-36" sizes="144px" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <TitleLink item={item} className="line-clamp-2 leading-snug font-medium" />
        {item.description && <p className="text-muted-foreground line-clamp-3 text-sm">{item.description}</p>}
        <div className="mt-auto pt-1">
          <DoneSwitch resourceId={item.id} title={item.title} done={item.done} hasQuiz={item.has_quiz} />
        </div>
      </div>
    </article>
  );
}

/** The empty right-hand cell of a blog post that has no podcast episode yet. */
export function PodcastPlaceholder() {
  return (
    <div
      className="text-muted-foreground hidden items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm md:flex md:h-[164px]"
      data-testid="podcast-placeholder"
    >
      <Headphones className="size-4" aria-hidden />
      No podcast episode yet
    </div>
  );
}

/** A book card: cover on top, then title, author and a short description. Three to a row on desktop. */
export function BookCard({ item }: { item: AcademyItem }) {
  return (
    <article
      className={cn("bg-card flex flex-col gap-3 rounded-xl border p-4", item.done && "border-primary/40")}
      data-testid="academy-item"
      data-kind="book"
      data-done={item.done}
    >
      <Thumb item={item} className="mx-auto aspect-[2/3] w-32" sizes="128px" />
      <div className="flex flex-1 flex-col gap-1">
        <TitleLink item={item} className="leading-snug font-medium" />
        {item.author && <p className="text-meta text-foreground/80">{item.author}</p>}
        {item.description && <p className="text-muted-foreground line-clamp-4 text-sm">{item.description}</p>}
        <div className="mt-auto pt-2">
          <DoneSwitch resourceId={item.id} title={item.title} done={item.done} hasQuiz={item.has_quiz} />
        </div>
      </div>
    </article>
  );
}
