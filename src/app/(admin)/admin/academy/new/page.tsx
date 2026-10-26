import type { Metadata } from "next";
import { AcademyManageNew } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Add to the Academy · Admin · UXDA Learn" };

export default async function AdminAcademyNewPage({ searchParams }: PageProps<"/admin/academy/new">) {
  const { kind } = await searchParams;
  return <AcademyManageNew base="/admin/academy" kind={typeof kind === "string" ? kind : undefined} />;
}
