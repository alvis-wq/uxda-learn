import Link from "next/link";
import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BriefImage } from "@/components/brief-image";
import { isBriefImageSrc, SIDE_IMAGE_TITLE } from "@/lib/content/images";
import { cn } from "@/lib/utils";

/** A link to somewhere in the app: `/challenges/x`, `#section` or `?filter=y`. A protocol-relative `//host` is external. */
export function isInternalHref(href: string | undefined): boolean {
  return !!href && ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#") || href.startsWith("?"));
}

/** The bits of a markdown (mdast) node the side-image step reads and writes. */
type MdNode = {
  type: string;
  children?: MdNode[];
  title?: string | null;
  value?: string;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

// From 768 px (md) the text and the image sit side by side, the image about 40% wide; below that the image goes under
// the text at full width.
const SIDE_ROW = "my-6 flex flex-col gap-4 md:flex-row md:items-start md:gap-8";
const SIDE_TEXT = "min-w-0 md:flex-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0";
const SIDE_FIGURE = "m-0 md:w-2/5 md:shrink-0";

/** A paragraph that holds nothing but one `![alt](src "side")` image. */
function isSideImageParagraph(node: MdNode): boolean {
  if (node.type !== "paragraph") return false;
  const kids = (node.children ?? []).filter((c) => !(c.type === "text" && !c.value?.trim()));
  return kids.length === 1 && kids[0].type === "image" && kids[0].title === SIDE_IMAGE_TITLE;
}

function groupSideImages(node: MdNode): void {
  if (!node.children) return;
  const out: MdNode[] = [];
  for (const child of node.children) {
    groupSideImages(child);
    const prev = out.at(-1);
    if (prev && isSideImageParagraph(child)) {
      out[out.length - 1] = {
        type: "sideImageRow",
        data: { hName: "div", hProperties: { className: SIDE_ROW.split(" "), dataTestid: "brief-side-row" } },
        children: [
          { type: "sideImageText", data: { hName: "div", hProperties: { className: SIDE_TEXT.split(" ") } }, children: [prev] },
          { ...child, data: { hName: "div", hProperties: { className: SIDE_FIGURE.split(" ") } } },
        ],
      };
    } else {
      out.push(child);
    }
  }
  node.children = out;
}

/**
 * remark step: a "side" image (a paragraph of its own, checked by content:validate) and the block just before it
 * become one row, text first, so a narrow screen stacks the image below the text.
 */
export function remarkSideImages() {
  return (tree: MdNode) => groupSideImages(tree);
}

/** Renders trusted repo markdown. Raw HTML is not rendered (react-markdown default); images only from public/challenges/. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSideImages]}
        components={{
          // Images from public/challenges/ only (checked again by content:validate, with alt text): full width at most,
          // never wider than the text column, lazy-loaded, and opened larger on click. A "side" one fills its column
          // next to the text. Anything else isn't shown.
          img: ({ src, alt, title }) =>
            isBriefImageSrc(typeof src === "string" ? src : null) ? (
              <BriefImage src={src as string} alt={alt ?? ""} side={title === SIDE_IMAGE_TITLE} />
            ) : null,
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
