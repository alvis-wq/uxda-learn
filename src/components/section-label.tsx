import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The small, muted label above a section ("Total points", "Overall progress", "Categories"): one style everywhere. */
export const SECTION_LABEL_CLASS = "text-meta text-foreground/80";

export function SectionLabel({
  as: Tag = "h2",
  id,
  className,
  children,
}: {
  as?: ElementType;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={cn(SECTION_LABEL_CLASS, className)}>
      {children}
    </Tag>
  );
}
