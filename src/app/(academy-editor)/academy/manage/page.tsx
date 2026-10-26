import type { Metadata } from "next";
import { AcademyManageList } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Academy · UXDA Learn" };

export default async function ManageAcademyPage({ searchParams }: PageProps<"/academy/manage">) {
  const { kind, status, review } = await searchParams;
  return <AcademyManageList base="/academy/manage" filters={{ kind: String(kind ?? ""), status: String(status ?? ""), review: String(review ?? "") }} />;
}
