"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approveSubmissions } from "./actions";

export type QueueRow = {
  id: string;
  learner: string;
  track: string;
  challenge: string;
  attempt: number;
  status: string;
  confidence: string | null;
  flags: string[];
  score: string;
  submitted: string;
  edited: boolean;
};

/** Only an AI-reviewed row has a score to approve with; one that's only submitted is reviewed by hand. */
const selectable = (r: QueueRow) => r.status === "ai_reviewed";
const clean = (r: QueueRow) => selectable(r) && r.confidence === "high" && r.flags.length === 0;

/** The review queue, with checkboxes to approve AI-reviewed submissions in one go (AI score and feedback). */
export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reviewed = rows.filter(selectable);
  const allSelected = reviewed.length > 0 && reviewed.every((r) => selected.has(r.id));
  const someSelected = reviewed.some((r) => selected.has(r.id));
  const chosen = rows.filter((r) => selected.has(r.id));
  const needsLook = chosen.filter((r) => !clean(r)).length;

  function toggle(id: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveSubmissions(chosen.map((r) => r.id));
      setConfirming(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      toast.success(
        `Approved ${res.approved} ${res.approved === 1 ? "submission" : "submissions"}.` +
          (res.skipped ? ` ${res.skipped} skipped: reviewed or changed meanwhile.` : ""),
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {reviewed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="bulk-actions">
          <Button type="button" disabled={pending || chosen.length === 0} onClick={() => setConfirming(true)}>
            <CheckCheck aria-hidden />
            Approve selected{chosen.length > 0 && ` (${chosen.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !reviewed.some(clean)}
            onClick={() => setSelected(new Set(reviewed.filter(clean).map((r) => r.id)))}
          >
            Select high confidence, no flags
          </Button>
          {chosen.length > 0 && (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all AI-reviewed submissions"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                disabled={pending || reviewed.length === 0}
                onCheckedChange={(v) => setSelected(v === true ? new Set(reviewed.map((r) => r.id)) : new Set())}
              />
            </TableHead>
            <TableHead>Learner</TableHead>
            <TableHead>Challenge</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>AI review</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Score</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id} data-testid="queue-row" data-state={selected.has(s.id) ? "selected" : undefined}>
              <TableCell>
                {selectable(s) && (
                  <Checkbox
                    aria-label={`Select ${s.learner}, ${s.challenge}`}
                    checked={selected.has(s.id)}
                    disabled={pending}
                    onCheckedChange={(v) => toggle(s.id, v === true)}
                  />
                )}
              </TableCell>
              <TableCell>
                <Link href={`/admin/submissions/${s.id}`} className="font-medium hover:underline">
                  {s.learner}
                </Link>
                <div className="text-muted-foreground text-xs">{s.track}</div>
              </TableCell>
              <TableCell>
                {s.challenge}
                <span className="text-muted-foreground ml-1 text-xs">#{s.attempt}</span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={s.status === "ai_reviewed" ? "default" : "outline"}>
                    {s.status === "ai_reviewed" ? "AI reviewed" : "Submitted"}
                  </Badge>
                  {s.edited && <Badge variant="outline">Edited</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {s.confidence === "low" && (
                    <Badge variant="destructive">
                      <AlertTriangle aria-hidden />
                      Low confidence
                    </Badge>
                  )}
                  {s.confidence && s.confidence !== "low" && (
                    <Badge variant="secondary" className="capitalize">
                      {s.confidence}
                    </Badge>
                  )}
                  {s.flags.map((f) => (
                    <Badge key={f} variant="outline">
                      {f}
                    </Badge>
                  ))}
                  {!s.confidence && <span className="text-muted-foreground text-xs">Not yet</span>}
                </div>
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.score}</TableCell>
              <TableCell className="text-muted-foreground hidden text-right text-xs sm:table-cell">{s.submitted}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent>
          <DialogTitle>
            Approve {chosen.length} {chosen.length === 1 ? "submission" : "submissions"}?
          </DialogTitle>
          <DialogDescription>
            Each is published with the AI review&apos;s score and feedback, and the learner sees them straight away. You can
            still change a score afterwards.
            {needsLook > 0 &&
              ` ${needsLook} of them ${needsLook === 1 ? "has" : "have"} medium or low confidence or a flag.`}
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={pending} onClick={approve} data-testid="confirm-bulk-approve">
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />}
              Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
