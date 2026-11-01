"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useOrders } from "./data";
import { OrderRow } from "./orders-page";

/**
 * A conversation's or a contact's orders (newest five), with «سفارش جدید» prefilled for them. Used in the inbox side
 * panel and on the contact page; renders nothing for roles without the orders permission.
 */
export function OrdersMini({ conversationId, contactId, heading }: { conversationId?: string; contactId?: string; heading: (count: number) => React.ReactNode }) {
  const t = useTranslations("orders");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const allowed = can(P.ordersRead);
  const orders = useOrders(ws, conversationId ? { conversationId } : { contactId }, { enabled: allowed, limit: 5 });
  if (!allowed) return null;
  const items = orders.data?.pages[0]?.items ?? [];
  const newHref = `/w/${ws}/orders/new?${conversationId ? `conversation=${conversationId}` : `contact=${contactId}`}`;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {heading(items.length)}
        {can(P.ordersWrite) ? (
          <Link href={newHref} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="size-4" aria-hidden />
            {t("new")}
          </Link>
        ) : null}
      </div>
      {orders.isPending ? (
        <Skeleton className="h-14" />
      ) : orders.isError ? (
        <p className="text-sm text-danger">{errorMessage(orders.error)}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noneYet")}</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {items.map((o) => (
            <OrderRow key={o.id} order={o} href={`/w/${ws}/orders/${o.id}`} compact />
          ))}
        </div>
      )}
      {orders.data?.pages[0]?.nextCursor && contactId ? (
        <Link href={`/w/${ws}/orders?contact=${contactId}`} className="inline-block text-sm text-primary hover:underline">
          {t("allForContact")}
        </Link>
      ) : null}
    </section>
  );
}
