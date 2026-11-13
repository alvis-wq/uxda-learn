"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * "View task": the brief (and how it's scored, and a milestone's "Before you start") in a modal, for when the learner
 * is further into the form and the brief is no longer on screen. The content is rendered on the server.
 */
export function TaskDialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-fit" data-testid="view-task">
          <FileText aria-hidden />
          View task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="task-dialog">
        <div className="grid gap-1 pr-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>The task, as it was set out at the start.</DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
