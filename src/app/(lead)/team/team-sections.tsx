import Link from "next/link";
import { cn } from "@/lib/utils";

/** Switch between the Team page's two views: challenges (the matrix) and the Academy. */
export function TeamSections({ current }: { current: "challenges" | "academy" }) {
  const items = [
    { key: "challenges", label: "Challenges", href: "/team" },
    { key: "academy", label: "Academy", href: "/team/academy" },
  ] as const;
  return (
    <nav aria-label="Team progress views" className="bg-muted mb-4 inline-flex w-fit rounded-full p-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? "page" : undefined}
          className={cn(
            "focus-visible:ring-ring/50 rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
            i.key === current ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
