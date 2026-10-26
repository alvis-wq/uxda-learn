import type { Metadata } from "next";
import { AcademyManageNew } from "@/components/academy-manage/pages";

export const metadata: Metadata = { title: "Add to the Academy · UXDA Learn" };

export default async function ManageAcademyNewPage({ searchParams }: PageProps<"/academy/manage/new">) {
  const { kind } = await searchParams;
  return <AcademyManageNew base="/academy/manage" kind={typeof kind === "string" ? kind : undefined} />;
}
