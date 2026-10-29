import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChannelsPage } from "@/features/channels/channels-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("channels");
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return <RequirePermission permission={P.settingsRead}><ChannelsPage status={params.status ?? null} reason={params.reason ?? null} channelId={params.channel ?? null} /></RequirePermission>;
}
