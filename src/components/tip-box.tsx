import { Lightbulb } from "lucide-react";
import { Markdown } from "@/components/markdown";

/** A challenge's `tip`: a short hint in a subtle box, shown above the questions. */
export function TipBox({ children }: { children: string }) {
  return (
    <aside aria-label="Tip" data-testid="tip" className="bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-lg border px-4 py-3 text-sm">
      <Lightbulb className="mt-[3px] size-4 shrink-0" aria-hidden />
      <Markdown className="prose-sm prose-p:my-0 prose-p:leading-snug text-muted-foreground prose-strong:text-foreground prose-a:text-foreground">{children}</Markdown>
    </aside>
  );
}
