import { History } from "lucide-react";
import { describeAudit, type AuditRow } from "@/lib/admin/challenge-settings";
import { formatDateTime } from "@/lib/utils";

/** Collapsible "who changed what, when" for one challenge's settings. Newest first. */
export function AuditHistory({ rows, open = false }: { rows: AuditRow[]; open?: boolean }) {
  return (
    <details className="group text-sm" open={open}>
      <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-1.5 text-meta">
        <History className="size-4" aria-hidden />
        Change history ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-meta">
          No changes since the challenge was created. Status, required and due date changes appear here.
        </p>
      ) : (
        <ol className="mt-2 grid gap-1.5 border-l pl-4" data-testid="audit-history">
          {rows.map((r) => {
            const { change, who } = describeAudit(r);
            return (
              <li key={r.id} className="grid gap-0.5">
                <span>{change}</span>
                <span className="text-muted-foreground text-meta">
                  {who} · <time dateTime={r.changed_at}>{formatDateTime(r.changed_at)}</time>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}
