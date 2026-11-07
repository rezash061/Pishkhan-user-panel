"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/keys";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";

/**
 * «لینک پرداخت» in the inbox composer: takes the conversation's latest order still to be paid, reuses its active Zarinpal
 * link or makes one, and puts a ready message with the link into the reply box. With no such order it offers to make one.
 */
export function PayLinkButton({ ws, conversationId, disabled, onInsert }: { ws: string; conversationId: string; disabled?: boolean; onInsert: (text: string) => void }) {
  const t = useTranslations("payments.inbox");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const orders = unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/orders", {
          params: { path: { workspaceId: ws }, query: { conversationId, status: ["awaiting_payment", "draft"], limit: 1 } },
        }),
      );
      const order = orders.items[0];
      if (!order) {
        toast.info(t("noOrder"), { action: { label: t("newOrder"), onClick: () => router.push(`/w/${ws}/orders/new?conversation=${conversationId}`) } });
        return;
      }
      const path = { workspaceId: ws, orderId: order.id };
      const links = unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/{orderId}/payment-links", { params: { path } }));
      const link =
        links.find((l) => l.status === "active") ??
        unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders/{orderId}/payment-links", { params: { path, header: { "Idempotency-Key": newIdempotencyKey() } } }));
      void qc.invalidateQueries({ queryKey: qk.paymentLinks(ws, order.id) });
      void qc.invalidateQueries({ queryKey: qk.orders(ws) });
      onInsert(t("message", { number: toPersianDigits(link.orderNumber), amount: formatToman(rialOf(link.amount) ?? 0), url: link.url }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === "payments.merchant_missing" ? t("merchantMissing") : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("button")} title={t("button")} disabled={disabled} loading={busy} onClick={() => void run()}>
      {busy ? null : <CreditCard />}
    </Button>
  );
}
