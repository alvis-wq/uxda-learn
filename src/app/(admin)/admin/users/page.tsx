import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { summarizeScores } from "@/lib/submissions/rules";
import { AdminSwitch, TrackSelect } from "./user-controls";

export const metadata: Metadata = { title: "Users · Admin · UXDA Learn" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name", { nullsFirst: false }),
    supabase.from("submissions").select("user_id,challenge_slug,status,final_score"),
  ]);
  if (error) throw new Error(`Couldn't load users: ${error.message}`);

  return (
    <section aria-labelledby="users-heading">
      <h1 id="users-heading" className="mb-6 text-2xl font-semibold tracking-tight">
        Users
      </h1>
      {profiles.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Track</TableHead>
                <TableHead className="hidden text-right md:table-cell">Score</TableHead>
                <TableHead className="hidden text-right md:table-cell">Completed</TableHead>
                <TableHead className="hidden text-right md:table-cell">Pending</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const s = summarizeScores((subs ?? []).filter((x) => x.user_id === p.id));
                const name = p.full_name ?? p.email;
                return (
                  <TableRow key={p.id} data-testid={`user-row-${p.email}`}>
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      <div className="text-muted-foreground text-xs">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      <TrackSelect userId={p.id} name={name} track={p.track} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.totalScore}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.completed}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.pending}</TableCell>
                    <TableCell>
                      <AdminSwitch userId={p.id} name={name} isAdmin={p.is_admin} isSelf={p.id === me.id} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
