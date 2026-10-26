import type { Metadata } from "next";
import { AcademyManageList } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Academy · Admin · UXDA Learn" };

export default async function AdminAcademyPage({ searchParams }: PageProps<"/admin/academy">) {
  const { kind, status, review } = await searchParams;
  return <AcademyManageList base="/admin/academy" filters={{ kind: String(kind ?? ""), status: String(status ?? ""), review: String(review ?? "") }} />;
}
