"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/misc";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";

export function AgentHeader() {
  const t = useTranslations("agent");
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.id}/agent`;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SectionTabs
        className="mb-5"
        tabs={[
          { href: base, label: t("tabs.settings") },
          { href: `${base}/test`, label: t("tabs.test") },
          { href: `${base}/log`, label: t("tabs.log"), prefix: true },
        ]}
      />
    </>
  );
}
