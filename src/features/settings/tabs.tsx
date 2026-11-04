"use client";

import { useTranslations } from "next-intl";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { P } from "@/lib/permissions";

export function SettingsTabs() {
  const t = useTranslations("settings");
  const { workspace, can } = useWorkspace();
  const base = `/w/${workspace.id}/settings`;
  return (
    <SectionTabs
      tabs={[
        { href: base, label: t("general") },
        { href: `${base}/business-hours`, label: t("businessHours") },
        ...(can(P.inboxRead) ? [{ href: `${base}/quick-replies`, label: t("quickReplies") }] : []),
        { href: `${base}/notifications`, label: t("notifications") },
        { href: `${base}/payments`, label: t("payments") },
        { href: `${base}/templates`, label: t("templates") },
        ...(can(P.crmRead) ? [{ href: `${base}/outage`, label: t("outage") }] : []),
        ...(can(P.auditRead) ? [{ href: `${base}/audit`, label: t("audit") }] : []),
      ]}
    />
  );
}
