import type { Metadata } from "next";
import { AcademyManageEdit } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Academy resource · UXDA Learn" };

export default async function ManageAcademyEditPage({ params }: PageProps<"/academy/manage/[id]">) {
  const { id } = await params;
  return <AcademyManageEdit base="/academy/manage" id={id} />;
}
