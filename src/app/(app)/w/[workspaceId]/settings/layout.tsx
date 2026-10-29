import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/page";
import { SettingsTabs } from "@/features/settings/tabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <PageContainer>
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">{t("title")}</h1>
      <SettingsTabs />
      <div className="mt-5">{children}</div>
    </PageContainer>
  );
}
