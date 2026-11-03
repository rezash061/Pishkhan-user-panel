import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckoutPage } from "@/features/billing/checkout-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.result");
  return { title: t("title") };
}

export default async function Page({ params }: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(checkoutId)) notFound();
  return (
    <RequirePermission permission={P.billingManage}>
      <CheckoutPage checkoutId={checkoutId} />
    </RequirePermission>
  );
}
