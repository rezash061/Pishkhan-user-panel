"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import type { Checkout } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDate, formatDateTime, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { isKind, isOverage, isPlanless, isWalletTopUp, toneOf } from "./checkout";
import { useCheckouts } from "./data";

/** «پرداخت‌ها و فاکتورها»: the last 100 checkouts; a paid one is the invoice, with its number, reference and card. */
export function CheckoutHistory({ ws }: { ws: string }) {
  const t = useTranslations("billing.history");
  const errorMessage = useErrorMessage();
  const checkouts = useCheckouts(ws);

  return (
    <Card>
      <CardHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-4 divide-y border-t">
        {checkouts.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : checkouts.isError ? (
          <EmptyState
            title={errorMessage(checkouts.error)}
            action={
              <Button variant="outline" onClick={() => checkouts.refetch()}>
                {t("retry")}
              </Button>
            }
          />
        ) : checkouts.data.length === 0 ? (
          <EmptyState icon={<Receipt />} title={t("empty")} />
        ) : (
          <ul className="divide-y">
            {checkouts.data.map((c) => (
              <CheckoutRow key={c.id} ws={ws} checkout={c} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function CheckoutRow({ ws, checkout: c }: { ws: string; checkout: Checkout }) {
  const t = useTranslations("billing");
  const status = t.has(`history.statuses.${c.status}`) ? t(`history.statuses.${c.status}` as "history.statuses.paid") : c.status;
  const kind = kindLabel(t, c.kind);
  const cycle = t(c.cycle === "annual" ? "cycle.annual" : "cycle.monthly");
  const details: [string, string][] = [];
  if (c.referenceId) details.push([t("result.reference"), toPersianDigits(c.referenceId)]);
  if (c.cardMask) details.push([t("result.card"), c.cardMask]);

  return (
    <li>
      <Link href={`/w/${ws}/billing/checkouts/${c.id}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-muted sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {c.invoiceNumber != null ? t("history.invoice", { number: toPersianDigits(c.invoiceNumber) }) : <span className="text-muted-foreground">{t("history.noInvoice")}</span>}
            <Badge tone={toneOf(c.status)}>{status}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {kind} · {isPlanless(c.kind) ? null : <>{c.planName} · {cycle} · </>} <time dateTime={c.paidAt ?? c.createdAt}>{formatDate(c.paidAt ?? c.createdAt)}</time>
          </p>
          {details.length ? (
            <p className="text-xs text-muted-foreground">
              {details.map(([label, value], i) => (
                <span key={label}>
                  {i > 0 ? " · " : null}
                  {label}{" "}
                  <bdi dir="ltr" className="font-mono">
                    {value}
                  </bdi>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="text-end">
          <p className="text-sm font-semibold tabular-nums">{formatToman(rialOf(c.amount) ?? 0)}</p>
          {c.couponCode ? (
            <p className="text-xs text-muted-foreground">
              {t("history.coupon")}{" "}
              <bdi dir="ltr" className="font-mono">
                {c.couponCode}
              </bdi>
            </p>
          ) : null}
          {(rialOf(c.walletUsed) ?? 0) > 0 ? <p className="text-xs text-muted-foreground">{t("history.wallet", { amount: formatToman(rialOf(c.walletUsed) ?? 0) })}</p> : null}
          {c.paidAt ? <p className="text-xs text-muted-foreground">{formatDateTime(c.paidAt)}</p> : null}
        </div>
      </Link>
    </li>
  );
}

/** «خرید تازه», «پرداخت مصرف مازاد», «شارژ کیف پول»… for a checkout's kind. */
export function kindLabel(t: ReturnType<typeof useTranslations<"billing">>, kind: string): string {
  if (isKind(kind)) return t(`plans.kind.${kind}`);
  if (isOverage(kind)) return t("overage.kind");
  if (isWalletTopUp(kind)) return t("wallet.kind");
  return kind;
}
