import type { Metadata } from "next";
import Link from "next/link";
import { UserCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/admin";
import { notSignedIn, titleIndex } from "@/lib/staff-titles";
import { createClient } from "@/lib/supabase/server";
import { summarizeScores } from "@/lib/submissions/rules";
import { PendingStaffRow, TitleField } from "./title-controls";
import { AdminSwitch, TesterSwitch, TrackSelect } from "./user-controls";

export const metadata: Metadata = { title: "Users · Admin · UXDA Learn" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: subs }, { data: titles, error: titlesError }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name", { nullsFirst: false }),
    supabase.from("submissions").select("user_id,challenge_slug,status,final_score").eq("is_test", false),
    supabase.from("staff_titles").select("email,job_title"),
  ]);
  if (error) throw new Error(`Couldn't load users: ${error.message}`);
  if (titlesError) throw new Error(`Couldn't load job titles: ${titlesError.message}`);
  const titleOf = titleIndex(titles);
  const pending = notSignedIn(titles, profiles.map((p) => p.email));

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
                <TableHead>Title</TableHead>
                <TableHead>Track</TableHead>
                <TableHead className="hidden text-right md:table-cell">Score</TableHead>
                <TableHead className="hidden text-right md:table-cell">Completed</TableHead>
                <TableHead className="hidden text-right md:table-cell">Pending</TableHead>
                <TableHead>Tester</TableHead>
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
                      <Link href={`/admin/users/${p.id}`} className="font-medium hover:underline" data-testid="user-link">
                        {name}
                      </Link>
                      <div className="text-muted-foreground text-xs">{p.email}</div>
                    </TableCell>
                    <TableCell>
                      <TitleField email={p.email} name={name} title={titleOf(p.email)} />
                    </TableCell>
                    <TableCell>
                      <TrackSelect userId={p.id} name={name} track={p.track} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.totalScore}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.completed}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{s.pending}</TableCell>
                    <TableCell>
                      <TesterSwitch userId={p.id} name={name} isTester={p.is_tester} />
                    </TableCell>
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

      <section aria-labelledby="pending-heading" className="mt-10 grid gap-2">
        <div>
          <h2 id="pending-heading" className="text-lg font-semibold tracking-tight">
            Not signed in yet
          </h2>
          <p className="text-muted-foreground text-sm">
            Job titles for emails nobody has signed in with. If one stays here, the email may be wrong — fix it here.
          </p>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon={UserCheck} title="Everyone with a title has signed in" />
        ) : (
          <ul className="divide-y" aria-label="Job titles for people who haven't signed in">
            {pending.map((t) => (
              <PendingStaffRow key={t.email} email={t.email} title={t.job_title} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
