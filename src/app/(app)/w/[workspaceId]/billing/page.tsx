import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BillingPage } from "@/features/billing/billing-page";
import { checkoutReturnPath } from "@/features/billing/checkout";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

export default async function Page({ params, searchParams }: { params: Promise<{ workspaceId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  // A checkout return pointed straight at this page (`?checkout={id}&status=`) opens that checkout.
  if (query.checkout) redirect(checkoutReturnPath(workspaceId, query.checkout, query.status));
  return (
    <RequirePermission permission={P.billingManage}>
      <BillingPage />
    </RequirePermission>
  );
}
