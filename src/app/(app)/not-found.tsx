import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <SearchX className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted-foreground text-sm">This page doesn&apos;t exist or isn&apos;t available to you.</p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
