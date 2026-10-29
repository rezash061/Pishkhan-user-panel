"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/misc";
import { SectionTabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";

export function CatalogHeader() {
  const t = useTranslations("catalog");
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.id}/catalog`;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SectionTabs
        className="mb-5"
        tabs={[
          { href: base, label: t("tabs.products") },
          { href: `${base}/categories`, label: t("tabs.categories") },
          { href: `${base}/storefront-cards`, label: t("tabs.cards") },
        ]}
      />
    </>
  );
}
