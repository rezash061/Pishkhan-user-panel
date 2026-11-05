"use client";

import { FileCheck2, Plus, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import type { Order } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toLatinDigits, toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { normalizeIranMobile } from "@/lib/phone";
import { orderTabs, useOrders, type OrderFilter, type OrderTab } from "./data";
import { OrderSourceBadge, OrderStatusBadge } from "./status";

const tabKeys = Object.keys(orderTabs) as OrderTab[];

/** What the search box means: a mobile number searches by phone, other digits by order number. */
export function searchFilter(text: string): Pick<OrderFilter, "number" | "phone"> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const mobile = normalizeIranMobile(trimmed);
  if (mobile) return { phone: mobile };
  const raw = toLatinDigits(trimmed).replace(/[#\s]/g, "");
  if (/^\d{1,12}$/.test(raw)) return { number: Number(raw) };
  return null;
}

/** «سفارش‌ها» (plan 3.8): status tabs, search by number or mobile, newest first. */
export function OrdersPage() {
  const t = useTranslations("orders");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = params.get("tab") as OrderTab | null;
  const tab: OrderTab = tabParam && tabParam in orderTabs ? tabParam : "all";
  const contactId = params.get("contact") ?? "";
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const search = searchFilter(query);
  const orders = useOrders(ws, { statuses: orderTabs[tab], ...(contactId ? { contactId } : {}), ...(search ?? {}) }, { enabled: search !== null });
  const items = orders.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(query.trim() || tab !== "all" || contactId);

  const setTab = (next: OrderTab) => {
    const sp = new URLSearchParams(params);
    if (next === "all") sp.delete("tab");
    else sp.set("tab", next);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/w/${ws}/orders/receipts`} className={buttonVariants({ variant: "outline" })}>
              <FileCheck2 aria-hidden />
              {t("receipts")}
            </Link>
            {can(P.ordersWrite) ? (
              <Link href={`/w/${ws}/orders/new`} className={buttonVariants()}>
                <Plus aria-hidden />
                {t("new")}
              </Link>
            ) : null}
          </div>
        }
      />
      <div role="tablist" aria-label={t("tabsLabel")} className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 scrollbar-thin sm:mx-0 sm:px-0">
        {tabKeys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm", tab === key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" inputMode="numeric" aria-label={t("search")} placeholder={t("searchPlaceholder")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {contactId ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const sp = new URLSearchParams(params);
              sp.delete("contact");
              router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
            }}
          >
            {t("clearContact")}
          </Button>
        ) : null}
      </div>
      {search === null ? <p className="text-sm text-muted-foreground">{t("searchHint")}</p> : null}

      <Card className={cn("divide-y overflow-hidden", orders.isPlaceholderData && "opacity-60")}>
        {search === null ? null : orders.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : orders.isError ? (
          <EmptyState title={errorMessage(orders.error)} action={<Button variant="outline" onClick={() => orders.refetch()}>{t("retry")}</Button>} />
        ) : items.length === 0 ? (
          filtered ? <EmptyState icon={<Search />} title={t("noResults")} /> : <EmptyState icon={<ShoppingBag />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          items.map((o) => <OrderRow key={o.id} order={o} href={`/w/${ws}/orders/${o.id}`} />)
        )}
      </Card>
      {orders.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => orders.fetchNextPage()} loading={orders.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </PageContainer>
  );
}

export function OrderRow({ order: o, href, compact }: { order: Order; href: string; compact?: boolean }) {
  const t = useTranslations("orders");
  const total = rialOf(o.total) ?? 0;
  const firstItem = o.items[0]?.title;
  return (
    <Link href={href} className={cn("flex items-center gap-3 hover:bg-surface-muted/50", compact ? "p-2.5" : "p-3 sm:p-4")}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{t("number", { n: toPersianDigits(o.number) })}</span>
          <OrderStatusBadge status={o.status} />
          <OrderSourceBadge order={o} />
        </p>
        <p className="truncate text-sm text-muted-foreground" dir="auto">
          {[o.customerName, firstItem ? (o.items.length > 1 ? t("itemsMore", { first: firstItem, n: toPersianDigits(o.items.length - 1) }) : firstItem) : t("noItems")].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 space-y-1 text-end">
        <p className="text-sm font-medium">{formatToman(total)}</p>
        <time dateTime={o.createdAt} title={formatDateTime(o.createdAt)} className="block text-xs text-muted-foreground">
          {formatRelative(o.createdAt)}
        </time>
      </div>
    </Link>
  );
}
