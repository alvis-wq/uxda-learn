"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteDraftResource, setResourceStatus } from "@/lib/academy/manage-actions";

const LABEL: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

/** Publish / unpublish / archive / restore, and delete for an unused draft. */
export function StatusControls({ base, id, status, hasQuiz, deletable }: { base: string; id: string; status: string; hasQuiz: boolean; deletable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(next: string, done: string) {
    start(async () => {
      const res = await setResourceStatus(id, next);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(done);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    start(async () => {
      const res = await deleteDraftResource(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Deleted.");
        router.push(base);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="status-controls">
      <Badge variant={status === "published" ? "default" : "secondary"}>{LABEL[status] ?? status}</Badge>
      {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Saving" />}
      {status === "draft" && (
        <Button size="sm" onClick={() => setStatus("published", "Published: everyone can see it now.")} disabled={pending || !hasQuiz} title={hasQuiz ? undefined : "Add the quiz first"}>
          Publish
        </Button>
      )}
      {status === "published" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("draft", "Back to draft: hidden from learners.")} disabled={pending}>
          Unpublish
        </Button>
      )}
      {status !== "archived" ? (
        <Button size="sm" variant="ghost" onClick={() => setStatus("archived", "Archived.")} disabled={pending}>
          Archive
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setStatus("draft", "Restored as a draft.")} disabled={pending}>
          Restore
        </Button>
      )}
      {deletable && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
          Delete
        </Button>
      )}
    </div>
  );
}
