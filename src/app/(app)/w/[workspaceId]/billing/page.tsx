import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BillingPage } from "@/features/billing/billing-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

export default function Page() {
  return (
    <RequirePermission permission={P.billingManage}>
      <BillingPage />
    </RequirePermission>
  );
}
