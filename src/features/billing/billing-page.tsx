"use client";

import { CalendarClock, CircleAlert, CircleCheck, Gem, Infinity as InfinityIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import type { CurrentPlan, Subscription, UsageMeter } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { planName } from "./checkout";
import { daysLeft, meterState, shareOf, useBillingPlans, useCurrentPlan, useUsage } from "./data";
import { CheckoutHistory } from "./history";
import { OverageBlockedBanner, OverageCard } from "./overage";
import { PlansCard } from "./plans";
import { WalletCard } from "./wallet";

/**
 * «اشتراک»: the current plan with any periods already paid for, this Jalali month's usage (UP-1.15), the plans on sale
 * with a quote and Zarinpal checkout (with a coupon and the wallet, BE-1.11), the wallet, and the payments and invoices (BE-2.8).
 */
export function BillingPage() {
  const t = useTranslations("billing");
  const { workspace } = useWorkspace();
  const current = useCurrentPlan(workspace.id);
  return (
    <PageContainer className="max-w-4xl space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OverageBlockedBanner ws={workspace.id} onBilling />
      <PlanCard ws={workspace.id} />
      <UsageCard ws={workspace.id} />
      <OverageCard ws={workspace.id} />
      <WalletCard ws={workspace.id} />
      <div id="plans" className="scroll-mt-4">
        <PlansCard ws={workspace.id} current={current.data} />
      </div>
      <CheckoutHistory ws={workspace.id} />
    </PageContainer>
  );
}

function PlanCard({ ws }: { ws: string }) {
  const t = useTranslations("billing");
  const errorMessage = useErrorMessage();
  const plan = useCurrentPlan(ws);
  if (plan.isPending) return <Skeleton className="h-36" />;
  if (plan.isError) return <p className="text-sm text-danger">{errorMessage(plan.error)}</p>;
  const p = plan.data;
  const name = p.source === "none" ? t("noPlan") : (p.planName ?? p.planCode ?? t("freePlan"));

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Gem className="size-4 text-primary" aria-hidden />
            {name}
            {p.trial ? <Badge tone="warning">{t("trial")}</Badge> : null}
            {p.source === "free" ? <Badge>{t("free")}</Badge> : null}
          </span>
        }
        description={<PlanDescription plan={p} />}
      />
      <CardBody className="space-y-3 text-sm">
        {p.subscription?.cycle ? <p>{t("current.cycle", { cycle: t(p.subscription.cycle === "annual" ? "cycle.annual" : "cycle.monthly") })}</p> : null}
        {p.upcoming?.length ? <Upcoming ws={ws} upcoming={p.upcoming} /> : null}
        <p className="text-muted-foreground">{t("upgradeHint")}</p>
      </CardBody>
    </Card>
  );
}

/** Periods already paid for that start later (renewals and downgrades, state `scheduled`), in the order they start. */
function Upcoming({ ws, upcoming }: { ws: string; upcoming: Subscription[] }) {
  const t = useTranslations("billing");
  const plans = useBillingPlans(ws);
  return (
    <div className="space-y-1.5 rounded-xl bg-surface-muted p-3">
      <p className="font-medium">{t("current.upcoming")}</p>
      <ul className="space-y-1">
        {upcoming.map((s) => {
          const plan = planName(plans.data, s.planCode);
          const cycle = t(s.cycle === "annual" ? "cycle.annual" : "cycle.monthly");
          return (
            <li key={s.id} className="flex items-start gap-1.5">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {s.endsAt
                ? t("current.upcomingRow", { plan, cycle, from: formatDate(s.startsAt), to: formatDate(s.endsAt) })
                : t("current.upcomingNoEnd", { plan, from: formatDate(s.startsAt) })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanDescription({ plan }: { plan: CurrentPlan }) {
  const t = useTranslations("billing");
  if (plan.source === "none") return t("noPlanBody");
  if (!plan.endsAt) return plan.source === "free" ? t("freeBody") : t("noEnd");
  const days = daysLeft(plan.endsAt);
  return t(plan.trial ? "trialEnds" : "ends", { date: formatDate(plan.endsAt), days: toPersianDigits(days) });
}

function UsageCard({ ws }: { ws: string }) {
  const t = useTranslations("billing");
  const errorMessage = useErrorMessage();
  const usage = useUsage(ws);
  return (
    <Card>
      <CardHeader
        title={t("usage")}
        description={usage.data ? t("period", { from: formatDate(usage.data.periodStart), to: formatDate(usage.data.periodEnd) }) : undefined}
      />
      <CardBody>
        {usage.isPending ? (
          <Skeleton className="h-40" />
        ) : usage.isError ? (
          <p className="text-sm text-danger">{errorMessage(usage.error)}</p>
        ) : usage.data.meters.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMeters")}</p>
        ) : (
          <ul className="space-y-5">
            {usage.data.meters.map((m) => (
              <Meter key={m.meter} meter={m} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Meter({ meter }: { meter: UsageMeter }) {
  const t = useTranslations("billing");
  const label = t.has(`meters.${meter.meter}`) ? t(`meters.${meter.meter}` as "meters.seats") : meter.meter;
  const share = shareOf(meter.used, meter.limit);
  const state = meterState(meter.used, meter.limit);
  const used = formatNumber(meter.used);
  const value = meter.limit === null ? t("unlimitedValue", { used }) : t("ofLimit", { used, limit: formatNumber(meter.limit) });

  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id={`meter-${meter.meter}`} className="font-medium">
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      {share === null ? (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <InfinityIcon className="size-3.5" aria-hidden />
          {t("unlimited")}
        </p>
      ) : (
        <>
          <div
            role="meter"
            aria-labelledby={`meter-${meter.meter}`}
            aria-valuemin={0}
            aria-valuemax={meter.limit ?? 0}
            aria-valuenow={Math.min(meter.used, meter.limit ?? meter.used)}
            aria-valuetext={value}
            className="h-2 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className={cn("h-full rounded-full", state === "full" ? "bg-danger" : state === "near" ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.max(share * 100, meter.used > 0 ? 2 : 0)}%` }}
            />
          </div>
          {state !== "ok" ? (
            <p className={cn("inline-flex items-center gap-1 text-xs", state === "full" ? "text-danger" : "text-[oklch(0.5_0.12_70)] dark:text-warning")}>
              <CircleAlert className="size-3.5" aria-hidden />
              {t(state === "full" ? "full" : "near")}
            </p>
          ) : (
            <p className="sr-only">
              <CircleCheck aria-hidden />
              {t("ok")}
            </p>
          )}
        </>
      )}
    </li>
  );
}
