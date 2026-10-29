"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/misc";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";

export function AutomationsHeader() {
  const t = useTranslations("automations");
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.id}/automations`;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SectionTabs
        className="mb-5"
        tabs={[
          { href: base, label: t("tabs.rules") },
          { href: `${base}/flows`, label: t("tabs.flows") },
          { href: `${base}/settings`, label: t("tabs.settings") },
        ]}
      />
    </>
  );
}
