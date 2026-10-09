"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  icon,
  label,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors [&_svg]:size-4",
        active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
