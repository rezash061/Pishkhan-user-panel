"use client";

import { ArrowRight, CircleCheck, CircleX, Clock, Printer, RefreshCw, TimerOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Checkout } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { isKind, isOverage, outcomeOf, subscriptionOf, toneOf, type Outcome } from "./checkout";
import { useCheckout, useCurrentPlan, useRefreshBilling } from "./data";

const icons = { paid: CircleCheck, failed: CircleX, cancelled: CircleX, expired: TimerOff, pending: Clock } as const;
const panels = {
  paid: "bg-success-soft text-success",
  failed: "bg-danger-soft text-danger",
  cancelled: "bg-surface-muted text-foreground",
  expired: "bg-surface-muted text-foreground",
  pending: "bg-warning-soft text-[oklch(0.5_0.12_70)] dark:text-warning",
} as const;

/**
 * Where Zarinpal returns the payer (through `/billing?checkout=&status=`), and every row of the history: the checkout as
 * the backend has it now. The `status` in the URL is only a hint; the page always shows what GET /checkouts/{id} says.
 * A paid checkout is the invoice and can be printed.
 */
export function CheckoutPage({ checkoutId }: { checkoutId: string }) {
  const t = useTranslations("billing.result");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const checkout = useCheckout(ws, checkoutId);
  const refreshBilling = useRefreshBilling(ws);
  const status = checkout.data?.status;
  const announced = useRef<string | null>(null);

  // A paid checkout changes the plan, its limits and the plan options: refetch them once.
  useEffect(() => {
    if (status === "paid" && announced.current !== "paid") void refreshBilling();
    announced.current = status ?? null;
  }, [status, refreshBilling]);

  return (
    <PageContainer className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/w/${ws}/billing`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowRight aria-hidden />
          {t("back")}
        </Link>
        {checkout.data?.status === "paid" ? (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print")}
          </Button>
        ) : null}
      </div>
      <h1 className="text-xl font-bold sm:text-2xl">{t("title")}</h1>
      {checkout.isPending ? (
        <Skeleton className="h-64" />
      ) : checkout.isError ? (
        <Card>
          <EmptyState
            icon={<CircleX />}
            title={checkout.error instanceof ApiError && checkout.error.status === 404 ? t("notFound") : errorMessage(checkout.error)}
            action={
              <Link href={`/w/${ws}/billing`} className={buttonVariants({ variant: "outline" })}>
                {t("back")}
              </Link>
            }
          />
        </Card>
      ) : (
        <Result checkout={checkout.data} refreshing={checkout.isFetching} onRefresh={() => void checkout.refetch()} />
      )}
    </PageContainer>
  );
}

function Result({ checkout: c, refreshing, onRefresh }: { checkout: Checkout; refreshing: boolean; onRefresh: () => void }) {
  const t = useTranslations("billing");
  const { workspace } = useWorkspace();
  const current = useCurrentPlan(workspace.id);
  const outcome: Outcome = outcomeOf(c);
  const Icon = icons[outcome];
  const cycle = t(c.cycle === "annual" ? "cycle.annual" : "cycle.monthly");
  const bought = outcome === "paid" ? subscriptionOf(current.data, c) : null;
  const startsLater = bought?.state === "scheduled";
  const credit = rialOf(c.credit) ?? 0;

  const body =
    outcome === "paid"
      ? isOverage(c.kind)
        ? t("result.paidOverage")
        : startsLater
          ? t("result.paidLater", { plan: c.planName, cycle, date: formatDateTime(bought.startsAt) })
          : t("result.paidBody", { plan: c.planName, cycle })
      : t(`result.${outcome}Body`);

  return (
    <>
      <div role={outcome === "pending" ? "status" : outcome === "paid" ? "status" : "alert"} className={cn("flex items-start gap-3 rounded-2xl p-4", panels[outcome])}>
        <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">{t(`result.${outcome}`)}</p>
          <p className="text-sm">{body}</p>
          {outcome === "failed" && c.error ? (
            <p className="text-sm">
              {t("result.gatewayCode")}{" "}
              <bdi dir="ltr" className="font-mono">
                {toPersianDigits(c.error)}
              </bdi>
            </p>
          ) : null}
        </div>
      </div>

      {outcome === "pending" ? (
        <Button variant="outline" onClick={onRefresh} loading={refreshing}>
          <RefreshCw aria-hidden />
          {t("result.refresh")}
        </Button>
      ) : outcome !== "paid" ? (
        <Link href={`/w/${workspace.id}/billing`} className={buttonVariants({ variant: "primary" })}>
          {t("result.tryAgain")}
        </Link>
      ) : null}

      <Card>
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {c.invoiceNumber != null ? <Item label={t("result.invoiceNumber")} value={toPersianDigits(c.invoiceNumber)} strong /> : null}
            <Item label={t("history.status")} value={<Badge tone={toneOf(c.status)}>{t.has(`history.statuses.${c.status}`) ? t(`history.statuses.${c.status}` as "history.statuses.paid") : c.status}</Badge>} />
            {c.referenceId ? <Item label={t("result.reference")} value={<bdi dir="ltr" className="font-mono">{toPersianDigits(c.referenceId)}</bdi>} /> : null}
            {c.cardMask ? <Item label={t("result.card")} value={<bdi dir="ltr" className="font-mono">{c.cardMask}</bdi>} /> : null}
            <Item label={t("result.plan")} value={c.planName} />
            <Item label={t("result.kind")} value={isKind(c.kind) ? t(`plans.kind.${c.kind}`) : isOverage(c.kind) ? t("overage.kind") : c.kind} />
            {isOverage(c.kind) ? null : <Item label={t("result.cycle")} value={cycle} />}
            <Item label={t("result.price")} value={formatToman(rialOf(c.price) ?? 0)} />
            {credit > 0 ? <Item label={t("result.credit")} value={formatToman(credit)} /> : null}
            <Item label={t("result.amount")} value={formatToman(rialOf(c.amount) ?? 0)} strong />
            <Item label={t("result.createdAt")} value={formatDateTime(c.createdAt)} />
            {c.paidAt ? <Item label={t("result.paidAt")} value={formatDateTime(c.paidAt)} /> : null}
            {bought ? <Item label={t("quote.starts")} value={formatDateTime(bought.startsAt)} /> : null}
            {bought?.endsAt ? <Item label={t("quote.ends")} value={formatDateTime(bought.endsAt)} /> : null}
          </dl>
        </CardBody>
      </Card>
    </>
  );
}

function Item({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block sm:space-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-bold")}>{value}</dd>
    </div>
  );
}
