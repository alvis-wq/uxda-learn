import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <ShieldX className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground text-sm">Your account doesn&apos;t have access to this page.</p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
