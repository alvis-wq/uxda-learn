import { Skeleton } from "@/components/ui/skeleton";

/** Inside the team segment, below the lead layout, so the 403 for everyone else is still a real status. */
export default function Loading() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-9 w-72 max-w-full rounded-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}
