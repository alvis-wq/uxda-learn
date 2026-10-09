import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// `text-meta` is a custom font size (globals.css); without this twMerge would treat it as a
// colour and drop e.g. `text-muted-foreground` when both are used.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ["meta"] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "12 Oct", or "12 Oct 2027" outside the current year. */
export function formatDate(value: string | Date, now = new Date()): string {
  const d = new Date(value);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

/** "12 Oct 2026, 14:05" — for audit-style timestamps (acknowledgements, exports). */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
