import type { Metadata } from "next";
import { AcademyManageEdit } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Academy resource · Admin · UXDA Learn" };

export default async function AdminAcademyEditPage({ params }: PageProps<"/admin/academy/[id]">) {
  const { id } = await params;
  return <AcademyManageEdit base="/admin/academy" id={id} />;
}
