"use client";

import { Bot, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/api/types";
import { orderStatuses, type OrderStatus } from "./data";

const tones: Record<OrderStatus, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  awaiting_payment: "warning",
  paid: "primary",
  preparing: "primary",
  shipped: "primary",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  refunded: "danger",
  returned: "danger",
};

export const isOrderStatus = (s: string): s is OrderStatus => (orderStatuses as readonly string[]).includes(s);

export function useStatusLabel() {
  const t = useTranslations("orders.status");
  return (s: string) => (isOrderStatus(s) ? t(s) : s);
}

export function OrderStatusBadge({ status }: { status: string }) {
  const label = useStatusLabel();
  return <Badge tone={isOrderStatus(status) ? tones[status] : "neutral"}>{label(status)}</Badge>;
}

/** Orders the AI or a flow saved on its own are marked, so the team checks them before asking for payment. */
export function OrderSourceBadge({ order }: { order: Pick<Order, "source"> }) {
  const t = useTranslations("orders.source");
  if (order.source === "ai")
    return (
      <Badge tone="primary">
        <Bot className="size-3" aria-hidden />
        {t("ai")}
      </Badge>
    );
  if (order.source === "flow")
    return (
      <Badge>
        <Workflow className="size-3" aria-hidden />
        {t("flow")}
      </Badge>
    );
  return null;
}
