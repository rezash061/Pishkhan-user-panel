import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import type { NavItem } from "./nav";

/** Placeholder for sections whose backend module is not built yet (automations, agent, knowledge, catalog, CRM, billing). */
export async function ComingSoon({ feature }: { feature: NavItem["key"] }) {
  const t = await getTranslations();
  return (
    <PageContainer>
      <Card>
        <EmptyState icon={<Hammer />} title={t("soon.title", { feature: t(`nav.${feature}`) })} body={t("soon.body")} />
      </Card>
    </PageContainer>
  );
}
