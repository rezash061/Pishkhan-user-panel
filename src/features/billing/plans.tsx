"use client";

import { Check, Info, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import type { BillingPlanOption, CurrentPlan } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatToman } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { annualSaving, cycleFor, cyclesOf, initialCycle, isKind, offersAnnual, priceOf, type CheckoutKind, type Cycle } from "./checkout";
import { useBillingPlans } from "./data";
import { QuoteDialog } from "./quote-dialog";

/**
 * «طرح‌ها» (BE-2.8): the plans on sale with what buying each would be now (new, renewal, upgrade, downgrade) or why it
 * cannot be bought. Picking one opens the quote; paying sends the browser to Zarinpal.
 */
export function PlansCard({ ws, current }: { ws: string; current: CurrentPlan | undefined }) {
  const t = useTranslations("billing.plans");
  const tc = useTranslations("billing.cycle");
  const errorMessage = useErrorMessage();
  const plans = useBillingPlans(ws);
  const [picked, setPicked] = useState<Cycle | null>(null);
  const cycle = picked ?? initialCycle(current);
  const [buying, setBuying] = useState<{ option: BillingPlanOption; cycle: Cycle; kind: CheckoutKind } | null>(null);
  const options = plans.data ?? [];

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          offersAnnual(options) ? (
            <Segmented<Cycle>
              label={t("cycleLabel")}
              value={cycle}
              onChange={setPicked}
              options={[
                { value: "monthly", label: tc("monthly") },
                { value: "annual", label: tc("annual") },
              ]}
            />
          ) : null
        }
      />
      <CardBody>
        {plans.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : plans.isError ? (
          <p className="text-sm text-danger">{errorMessage(plans.error)}</p>
        ) : options.length === 0 ? (
          <EmptyState title={t("empty")} body={t("emptyBody")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <PlanOption key={o.plan.id} option={o} cycle={cycle} onBuy={(c, kind) => setBuying({ option: o, cycle: c, kind })} />
            ))}
          </ul>
        )}
      </CardBody>
      {buying ? <QuoteDialog ws={ws} plan={buying.option.plan} cycle={buying.cycle} kind={buying.kind} onClose={() => setBuying(null)} /> : null}
    </Card>
  );
}

function PlanOption({ option: o, cycle: picked, onBuy }: { option: BillingPlanOption; cycle: Cycle; onBuy: (cycle: Cycle, kind: CheckoutKind) => void }) {
  const t = useTranslations("billing.plans");
  const codeMessage = useCodeMessage();
  const plan = o.plan;
  const cycle = cycleFor(plan, picked);
  const price = cycle ? priceOf(plan, cycle) : null;
  const offered = cyclesOf(plan);
  const saving = cycle === "annual" ? annualSaving(plan) : null;
  const kind = isKind(o.kind) ? o.kind : null;
  const titleId = `plan-${plan.id}`;
  const overage = rialOf(plan.overagePerConversation);

  return (
    <li
      aria-labelledby={titleId}
      className={cn("flex flex-col gap-3 rounded-2xl border p-4", o.current && "border-primary ring-1 ring-primary", plan.highlighted && !o.current && "border-primary/50")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 id={titleId} className="font-semibold">
            {plan.name}
          </h3>
          {plan.tagline ? <p className="text-xs text-muted-foreground">{plan.tagline}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {o.current ? <Badge tone="primary">{t("current")}</Badge> : null}
          {plan.highlighted ? (
            <Badge tone="warning">
              <Sparkles className="size-3" aria-hidden />
              {t("highlighted")}
            </Badge>
          ) : null}
        </div>
      </div>

      <div>
        {plan.isFree || price === null ? (
          <p className="text-xl font-bold">{t("free")}</p>
        ) : (
          <p className="text-xl font-bold tabular-nums">
            {formatToman(price)} <span className="text-sm font-normal text-muted-foreground">{t(cycle === "annual" ? "perYear" : "perMonth")}</span>
          </p>
        )}
        {saving ? <p className="text-xs font-medium text-[oklch(0.45_0.12_155)] dark:text-success">{t("saving", { percent: toPersianDigits(saving) })}</p> : null}
        {!plan.isFree && offered.length === 1 && offered[0] !== picked ? <p className="text-xs text-muted-foreground">{t(offered[0] === "annual" ? "onlyAnnual" : "onlyMonthly")}</p> : null}
      </div>

      <ul className="space-y-1 text-sm">
        <Limit value={plan.aiConversations} some="aiConversations" none="aiUnlimited" />
        <Limit value={plan.channelAccounts} some="channels" none="channelsUnlimited" />
        <Limit value={plan.seats} some="seats" none="seatsUnlimited" />
        {plan.features
          .filter((f) => f.included)
          .map((f) => (
            <li key={f.key} className="flex items-start gap-1.5">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                {f.label}
                {f.limit ? <span className="text-muted-foreground"> ({toPersianDigits(f.limit)})</span> : null}
              </span>
            </li>
          ))}
        {overage ? <li className="text-xs text-muted-foreground">{t("overage", { price: formatToman(overage) })}</li> : null}
      </ul>

      <div className="mt-auto space-y-1.5">
        {kind && cycle ? (
          <>
            <Button className="w-full" variant={kind === "downgrade" ? "outline" : "primary"} onClick={() => onBuy(cycle, kind)} aria-describedby={`${titleId}-kind`}>
              {t(`action.${kind}`)}
            </Button>
            <p id={`${titleId}-kind`} className="text-xs text-muted-foreground">
              <span className="font-medium">{t(`kind.${kind}`)}:</span> {t(`kindHint.${kind}`)}
            </p>
          </>
        ) : o.unavailable && !plan.isFree ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-surface-muted p-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">{t("unavailableTitle")}:</span> {codeMessage(o.unavailable) ?? o.unavailable}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Limit({ value, some, none }: { value: number | null; some: "aiConversations" | "channels" | "seats"; none: "aiUnlimited" | "channelsUnlimited" | "seatsUnlimited" }) {
  const t = useTranslations("billing.plans");
  return (
    <li className="flex items-start gap-1.5">
      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      {value === null ? t(none) : t(some, { n: formatNumber(value) })}
    </li>
  );
}
