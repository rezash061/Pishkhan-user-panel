"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/misc";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";

export function ContactsHeader({ action }: { action?: React.ReactNode }) {
  const t = useTranslations("contacts");
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.id}/contacts`;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} action={action} />
      <SectionTabs
        className="mb-5"
        tabs={[
          { href: base, label: t("tabs.contacts") },
          { href: `${base}/segments`, label: t("tabs.segments"), prefix: true },
          { href: `${base}/tags`, label: t("tabs.tags") },
          { href: `${base}/fields`, label: t("tabs.fields") },
          { href: `${base}/forms`, label: t("tabs.forms"), prefix: true },
        ]}
      />
    </>
  );
}
