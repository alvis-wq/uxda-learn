import Image from "next/image";
import { BookMarked, BookOpen, ExternalLink, Headphones, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayEpisodeButton } from "@/components/podcast-player";
import { LISTEN_LABEL, academyImageUrl, episodeUrl, listenLinks, youtubeEmbedUrl, type AcademyItem } from "@/lib/academy/resources";
import { cn } from "@/lib/utils";
import { DoneSwitch } from "./quiz-dialog";
import { ReadingToggle } from "./reading-toggle";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const KIND_ICON = { blog: Newspaper, podcast: Headphones, book: BookOpen } as const;

/** Where a resource opens: its page, or for a podcast episode the first link to that episode (Spotify, YouTube, Buzzsprout). */
function openUrl(item: AcademyItem): string | null {
  return item.kind === "podcast" ? episodeUrl(item) : item.url;
}

/** The resource's title as a link to it (new tab), or plain text when it has no link. */
function TitleLink({ item, className }: { item: AcademyItem; className?: string }) {
  const href = openUrl(item);
  if (!href) return <h3 className={className}>{item.title}</h3>;
  return (
    <h3 className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:underline">
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

/**
 * A small link to the other half of a post/episode pair: "Listen to podcast" on a post, "Read the blog" on an episode.
 * Opens the post's page, or the episode's first place to listen.
 */
function CounterpartLink({ item }: { item: AcademyItem }) {
  const href = openUrl(item);
  if (!href) return null;
  const isPodcast = item.kind === "podcast";
  const Icon = isPodcast ? Headphones : Newspaper;
  return (
    <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid="counterpart-link">
        <Icon className="size-3.5" aria-hidden />
        {isPodcast ? "Listen to podcast" : "Read the blog"}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}

/** "Listen on Spotify · YouTube · Buzzsprout": where this episode can be heard (Spotify may be the show), each in a new tab. */
function ListenLinks({ item }: { item: AcademyItem }) {
  const links = listenLinks(item);
  if (links.length < 2) return null;
  return (
    <p className="text-meta text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1" data-testid="listen-links">
      <span>Listen on</span>
      {links.map((l, i) => (
        <span key={l.service} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/90 font-medium underline-offset-2 hover:underline focus-visible:underline"
            data-service={l.service}
          >
            {LISTEN_LABEL[l.service]}
            <span className="sr-only">{l.show ? " (the podcast's page, opens in a new tab)" : " (opens in a new tab)"}</span>
          </a>
        </span>
      ))}
    </p>
  );
}

/**
 * One blog post or podcast episode: thumbnail left, text right. `counterpart`: the episode about this post, or the
 * post this episode is about. An episode with a YouTube video gets "Play" (the floating player).
 */
export function ResourceRowItem({ item, counterpart }: { item: AcademyItem; counterpart?: AcademyItem }) {
  const embedUrl = item.kind === "podcast" ? youtubeEmbedUrl(item) : null;
  return (
    <article
      className={cn("bg-card flex gap-4 rounded-xl border p-3 sm:min-h-[164px]", item.done && "border-primary/40")}
      data-testid="academy-item"
      data-kind={item.kind}
      data-done={item.done}
    >
      <Thumb item={item} className="h-24 w-24 sm:h-auto sm:min-h-[138px] sm:w-36 sm:self-stretch" sizes="144px" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {item.released_on && (
          <p className="text-meta text-muted-foreground">
            <time dateTime={item.released_on}>{dateFmt.format(new Date(item.released_on))}</time>
          </p>
        )}
        <TitleLink item={item} className="line-clamp-2 leading-snug font-medium" />
        {item.description && <p className="text-muted-foreground line-clamp-2 text-sm">{item.description}</p>}
        {item.kind === "podcast" && <ListenLinks item={item} />}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <DoneSwitch resourceId={item.id} title={item.title} done={item.done} hasQuiz={item.has_quiz} />
          {(embedUrl || counterpart) && (
            <div className="flex flex-wrap items-center gap-2">
              {embedUrl && <PlayEpisodeButton episode={{ id: item.id, title: item.title, embedUrl }} />}
              {counterpart && <CounterpartLink item={counterpart} />}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * A book card: cover on top, then title, author and a short description. Three to a row on desktop. A book the user is
 * reading now gets a badge and an accent border; once done it's only done.
 */
export function BookCard({ item }: { item: AcademyItem }) {
  const reading = item.reading && !item.done;
  return (
    <article
      className={cn(
        "bg-card relative flex flex-col gap-3 rounded-xl border p-4",
        item.done && "border-primary/40",
        reading && "border-primary ring-primary/30 ring-2",
      )}
      data-testid="academy-item"
      data-kind="book"
      data-done={item.done}
      data-reading={reading}
    >
      {reading && (
        <Badge className="absolute top-3 left-3" data-testid="reading-badge">
          <BookMarked aria-hidden />
          Reading now
        </Badge>
      )}
      <Thumb item={item} className="mx-auto aspect-[2/3] w-32" sizes="128px" />
      <div className="flex flex-1 flex-col gap-1">
        <TitleLink item={item} className="leading-snug font-medium" />
        {item.author && <p className="text-meta text-foreground/80">{item.author}</p>}
        {item.description && <p className="text-muted-foreground line-clamp-4 text-sm">{item.description}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <DoneSwitch resourceId={item.id} title={item.title} done={item.done} hasQuiz={item.has_quiz} />
          {!item.done && <ReadingToggle key={String(item.reading)} resourceId={item.id} title={item.title} reading={item.reading} />}
        </div>
      </div>
    </article>
  );
}
