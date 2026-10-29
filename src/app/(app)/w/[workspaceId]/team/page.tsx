import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TeamPage } from "@/features/team/team-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("title") };
}

export default function Page() {
  return <TeamPage />;
}
