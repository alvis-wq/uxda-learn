import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getPathPage } from "@/lib/data/learner";
import { PathView } from "./path-view";

export const metadata: Metadata = { title: "Path · UXDA Learn" };

export default async function PathPage({ params }: PageProps<"/paths/[slug]">) {
  const { slug } = await params;
  const profile = await requireOnboardedProfile();
  const data = await getPathPage(profile, slug);
  if (!data) notFound();
  return <PathView path={data.path} category={data.category} states={data.states} summary={data.summary} />;
}
