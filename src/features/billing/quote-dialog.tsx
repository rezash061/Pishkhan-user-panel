"use client";

import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import type { PublicPlan } from "@/lib/api/types";
import { formatDateTime, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import type { CheckoutKind, Cycle } from "./checkout";
import { newIdempotencyKey, useCheckoutQuote, useStartCheckout } from "./data";

/** Zarinpal's smallest payment (backend `CheckoutPlanner.MinimumAmount`), 1,000 Toman. */
const MINIMUM_RIAL = 10_000;

/**
 * The quote step: what buying the plan costs now (price, the credit an upgrade gets, the amount) and when the period starts
 * and ends. «پرداخت» opens the checkout with one Idempotency-Key per dialog, so a double tap opens one payment.
 */
export function QuoteDialog({ ws, plan, cycle, kind, onClose }: { ws: string; plan: PublicPlan; cycle: Cycle; kind: CheckoutKind; onClose: () => void }) {
  const t = useTranslations("billing.quote");
  const tp = useTranslations("billing.plans");
  const tc = useTranslations("billing.cycle");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const quote = useCheckoutQuote(ws, plan.id, cycle);
  const start = useStartCheckout(ws);
  const [key] = useState(newIdempotencyKey);
  const q = quote.data;
  // The quote may say otherwise than the list did (the subscription changed in between); the quote wins.
  const shownKind = (q?.kind as CheckoutKind | undefined) ?? kind;
  const amount = rialOf(q?.amount) ?? 0;
  const price = rialOf(q?.price) ?? 0;
  const credit = rialOf(q?.credit) ?? 0;
  const startsNow = shownKind === "new" || shownKind === "upgrade";
  const redirecting = start.isPending || start.isSuccess;

  return (
    <Dialog
      open
      onClose={redirecting ? () => undefined : onClose}
      variant="sheet"
      title={t("title", { kind: tp(`kind.${shownKind}`), plan: plan.name })}
      description={tp(`kindHint.${shownKind}`)}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={redirecting}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() => q && start.mutate({ planId: plan.id, cycle, idempotencyKey: key })}
            disabled={!q}
            loading={redirecting}
          >
            <CreditCard aria-hidden />
            {redirecting ? t("redirecting") : t("pay", { amount: formatToman(amount) })}
          </Button>
        </>
      }
    >
      {quote.isPending ? (
        <div className="space-y-2" aria-busy>
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : !q ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {errorMessage(quote.error)}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <dl className="divide-y rounded-xl border">
            <Row label={t("price", { cycle: tc(q.cycle === "annual" ? "annualLong" : "monthlyLong") })} value={formatToman(price)} />
            {credit > 0 ? <Row label={t("credit")} value={`− ${formatToman(credit)}`} tone="success" /> : null}
            <Row label={t("amount")} value={formatToman(amount)} strong />
            <Row label={t("starts")} value={startsNow ? t("startsNow") : formatDateTime(q.startsAt)} />
            <Row label={t("ends")} value={formatDateTime(q.endsAt)} />
          </dl>
          {amount === MINIMUM_RIAL && price - credit < MINIMUM_RIAL ? <p className="text-xs text-muted-foreground">{t("minimum")}</p> : null}
          <p className="text-xs text-muted-foreground">{t("gateway")}</p>
        </div>
      )}
      {start.isError ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {errorMessage(start.error)}
        </p>
      ) : null}
    </Dialog>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-base font-bold tabular-nums" : tone === "success" ? "tabular-nums text-[oklch(0.45_0.12_155)] dark:text-success" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
