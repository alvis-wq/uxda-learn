import Link from "next/link";
import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** A link to somewhere in the app: `/challenges/x`, `#section` or `?filter=y`. A protocol-relative `//host` is external. */
export function isInternalHref(href: string | undefined): boolean {
  return !!href && ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || href.startsWith("?"));
}

/** Renders trusted repo markdown. Raw HTML is not rendered (react-markdown default). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            // Links into the app (challenges, categories, anchors) stay in the tab, no icon. Every other link opens in a
            // new one, with an icon and a screen-reader note saying so.
            isInternalHref(href) ? (
              <Link href={href!}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
                <ExternalLink aria-hidden className="ml-1 inline size-[0.7em] align-baseline" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
