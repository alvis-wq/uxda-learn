import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders trusted repo markdown. Raw HTML is not rendered (react-markdown default). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            // A link within the page stays in the tab; every other link opens in a new one, with an icon and a
            // screen-reader note saying so.
            href?.startsWith("#") ? (
              <a href={href}>{children}</a>
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
