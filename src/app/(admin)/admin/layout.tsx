import { Download } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <nav aria-label="Admin" className="flex flex-wrap items-center gap-1">
          <NavLink href="/admin" label="Review queue" icon={null} exact showLabel />
          <NavLink href="/admin/users" label="Users" icon={null} showLabel />
          <NavLink href="/admin/required" label="Required progress" icon={null} showLabel />
          <NavLink href="/admin/acknowledgements" label="Acknowledgements" icon={null} showLabel />
          <NavLink href="/admin/content" label="Content" icon={null} showLabel />
        </nav>
        <Button asChild variant="outline" size="sm">
          {/* Plain <a>: the route handler returns a file download. */}
          <a href="/admin/export/scores.csv" download>
            <Download aria-hidden />
            Export scores (CSV)
          </a>
        </Button>
      </div>
      {children}
    </div>
  );
}
