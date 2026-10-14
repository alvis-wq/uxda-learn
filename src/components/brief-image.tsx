"use client";

import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * An image in a brief (from public/challenges/, checked by the caller). The image is a button that opens it larger in
 * a dialog: focus moves into it and back on close, Escape or the close button closes it, and the alt text names both
 * the button and the dialog. `side` fills its column (the Markdown component lays it out next to the text before it).
 */
export function BriefImage({ src, alt, side = false }: { src: string; alt: string; side?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/brief-image relative block max-w-full cursor-zoom-in rounded-lg outline-none",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            side ? "w-full" : "my-4 w-fit",
          )}
          data-testid="brief-image-open"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static images from public/challenges */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={cn("m-0 block h-auto max-w-full rounded-lg border", side ? "w-full" : "w-auto")}
            data-testid="brief-image"
            data-side={side ? "" : undefined}
          />
          <span
            aria-hidden
            className="bg-background/90 text-foreground absolute top-2 right-2 grid size-8 place-items-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover/brief-image:opacity-100 group-focus-visible/brief-image:opacity-100 motion-reduce:transition-none"
          >
            <Maximize2 className="size-4" />
          </span>
          <span className="sr-only"> (open larger)</span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-auto max-w-[calc(100vw-2rem)] gap-3 p-3 pt-12 sm:max-w-[min(calc(100vw-4rem),1600px)] motion-reduce:animate-none!"
        aria-describedby={undefined}
        data-testid="brief-image-dialog"
      >
        <DialogTitle className="text-muted-foreground absolute top-4 left-4 right-12 truncate text-sm font-medium">{alt}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- static images from public/challenges */}
        <img src={src} alt={alt} className="mx-auto block h-auto max-h-[calc(100dvh-7rem)] w-auto max-w-full rounded-md object-contain" />
      </DialogContent>
    </Dialog>
  );
}
