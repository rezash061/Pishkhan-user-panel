"use client";

import { AlertOctagon, CreditCard, Gauge } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import type { Overage } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf, tomanOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { useBillingPlans } from "./data";
import { capShare, capValid, hasDue, includedShare, maxCapRial, overageRequest, refusing } from "./overage-model";
import { newIdempotencyKey, useOverage, useOverageCharges, useStartOverageCheckout, useUpdateOverage } from "./overage-data";

const stateTones = { within: "success", overage: "primary", plan_limit: "warning", overage_cap: "warning", overage_unpaid: "danger" } as const;

/**
 * When an unpaid overage charge has stopped the AI (`blocked`), a prominent notice with the way out: pay. Shown on the
 * billing page and the dashboard.
 */
export function OverageBlockedBanner({ ws, onBilling = false }: { ws: string; onBilling?: boolean }) {
  const t = useTranslations("billing.overage");
  const { can } = useWorkspace();
  const overage = useOverage(ws, can(P.settingsRead));
  const o = overage.data;
  if (!o?.blocked) return null;
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm text-[oklch(0.45_0.17_25)] dark:text-danger">
      <AlertOctagon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{t("blockedTitle")}</p>
        <p>{t("blockedBody", { amount: formatToman(rialOf(o.due) ?? 0) })}</p>
      </div>
      {can(P.billingManage) ? onBilling ? <PayButton ws={ws} overage={o} /> : (
        <Link href={`/w/${ws}/billing`} className={buttonVariants({ size: "sm", variant: "danger" })}>
          {t("goPay")}
        </Link>
      ) : null}
    </div>
  );
}

/** «مصرف مازاد» (BE-2.8): conversations beyond the plan this period, their cost, the cap and the settings. */
export function OverageCard({ ws }: { ws: string }) {
  const t = useTranslations("billing.overage");
  const errorMessage = useErrorMessage();
  const { can } = useWorkspace();
  const overage = useOverage(ws);

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Gauge className="size-4 text-primary" aria-hidden />{t("title")}</span>}
        description={overage.data ? t("period", { from: formatDate(overage.data.periodStart), to: formatDate(overage.data.periodEnd) }) : undefined}
        action={overage.data ? <Badge tone={stateTones[overage.data.state as keyof typeof stateTones] ?? "neutral"}>{t(`states.${overage.data.state}` as "states.within")}</Badge> : null}
      />
      <CardBody className="space-y-4">
        {overage.isPending ? (
          <Skeleton className="h-32" />
        ) : overage.isError ? (
          <p className="text-sm text-danger">{errorMessage(overage.error)}</p>
        ) : !overage.data.available ? (
          <Unavailable ws={ws} overage={overage.data} />
        ) : (
          <>
            <Usage overage={overage.data} />
            {hasDue(overage.data) && can(P.billingManage) ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                <span>{t("due", { amount: formatToman(rialOf(overage.data.due) ?? 0) })}</span>
                <PayButton ws={ws} overage={overage.data} />
              </div>
            ) : null}
            {can(P.billingManage) ? <Settings key={`${overage.data.enabled}-${rialOf(overage.data.cap)}-${overage.data.capIsDefault}`} ws={ws} overage={overage.data} /> : null}
          </>
        )}
      </CardBody>
      {can(P.billingManage) && overage.data?.available !== false ? <Charges ws={ws} /> : null}
    </Card>
  );
}

function Unavailable({ ws, overage: o }: { ws: string; overage: Overage }) {
  const t = useTranslations("billing.overage");
  return (
    <div className="space-y-2 text-sm">
      {o.included !== null ? <p>{t("usedOfIncluded", { used: formatNumber(o.used), included: formatNumber(o.included) })}</p> : null}
      <p className="text-muted-foreground">{t("unavailable")}</p>
      <a href={`/w/${ws}/billing#plans`} className={buttonVariants({ size: "sm", variant: "outline" })}>
        {t("upgrade")}
      </a>
    </div>
  );
}

function Usage({ overage: o }: { overage: Overage }) {
  const t = useTranslations("billing.overage");
  const inc = includedShare(o);
  const cap = capShare(o);
  const price = rialOf(o.pricePerConversation);
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span id="ov-included" className="font-medium">
            {t("included")}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {o.included === null ? t("unlimited") : t("usedOfIncluded", { used: formatNumber(o.used), included: formatNumber(o.included) })}
          </span>
        </div>
        {inc !== null ? (
          <div role="meter" aria-labelledby="ov-included" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(inc * 100)} className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div className={cn("h-full rounded-full", inc >= 1 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.max(inc * 100, o.used > 0 ? 2 : 0)}%` }} />
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-muted p-2">
          <dd className="text-lg font-bold tabular-nums">{formatNumber(o.extra)}</dd>
          <dt className="text-xs text-muted-foreground">{t("extra")}</dt>
        </div>
        <div className="rounded-xl bg-surface-muted p-2">
          <dd className="text-lg font-bold tabular-nums">{price ? formatToman(price) : "—"}</dd>
          <dt className="text-xs text-muted-foreground">{t("unitPrice")}</dt>
        </div>
        <div className="rounded-xl bg-surface-muted p-2">
          <dd className="text-lg font-bold tabular-nums">{formatToman(rialOf(o.amount) ?? 0)}</dd>
          <dt className="text-xs text-muted-foreground">{t("amountSoFar")}</dt>
        </div>
      </dl>
      {o.enabled && cap !== null ? (
        <div className="space-y-1">
          <p id="ov-cap" className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("capLabel")}</span>
            <span className="tabular-nums">{t("ofCap", { amount: formatToman(rialOf(o.amount) ?? 0), cap: formatToman(rialOf(o.cap) ?? 0) })}</span>
          </p>
          <div role="meter" aria-labelledby="ov-cap" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cap * 100)} className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className={cn("h-full rounded-full", cap >= 1 ? "bg-danger" : "bg-primary")} style={{ width: `${cap * 100}%` }} />
          </div>
        </div>
      ) : null}
      <p className={cn("text-sm", refusing(o.state) ? "font-medium" : "text-muted-foreground")}>{t(`stateHints.${o.state}` as "stateHints.within")}</p>
    </div>
  );
}

function Settings({ ws, overage: o }: { ws: string; overage: Overage }) {
  const t = useTranslations("billing.overage");
  const errorMessage = useErrorMessage();
  const update = useUpdateOverage(ws);
  const plans = useBillingPlans(ws);
  const monthly = o.capIsDefault ? rialOf(o.cap) : (rialOf(plans.data?.find((p) => p.current)?.plan.monthly) ?? null);
  const [enabled, setEnabled] = useState(o.enabled);
  const [mode, setMode] = useState<"default" | "custom">(o.capIsDefault ? "default" : "custom");
  const [cap, setCap] = useState<number | null>(o.capIsDefault ? null : tomanOf(o.cap));
  // Switched off, the cap is kept as it is; only an enabled custom cap needs checking.
  const body = enabled ? overageRequest(enabled, mode, cap) : { enabled: false, cap: o.capIsDefault ? null : rialOf(o.cap) };
  const valid = !enabled || mode === "default" || (cap !== null && capValid(body.cap, monthly));
  const dirty = enabled !== o.enabled || (mode === "default") !== o.capIsDefault || (mode === "custom" && body.cap !== rialOf(o.cap));

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("enabled")}</span>
        <Switch label={t("enabled")} checked={enabled} onChange={setEnabled} />
      </div>
      <p className="text-xs text-muted-foreground">{t("enabledHint")}</p>
      {enabled ? (
        <>
          <Segmented<"default" | "custom">
            label={t("capMode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "default", label: monthly ? t("capDefault", { amount: formatToman(monthly) }) : t("capDefaultPlain") },
              { value: "custom", label: t("capCustom") },
            ]}
          />
          {mode === "custom" ? (
            <Field label={t("cap")} htmlFor="ov-cap-input" hint={t("capHint", { max: formatToman(maxCapRial(monthly)) })} error={cap !== null && !valid ? t("capInvalid", { max: formatToman(maxCapRial(monthly)) }) : null}>
              <MoneyInput id="ov-cap-input" value={cap} invalid={cap !== null && !valid} onChange={setCap} />
            </Field>
          ) : null}
        </>
      ) : null}
      {update.isError ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(update.error)}
        </p>
      ) : null}
      <Button size="sm" disabled={!dirty || !valid} loading={update.isPending} onClick={() => update.mutate(body, { onSuccess: () => toast.success(t("saved")) })}>
        {t("save")}
      </Button>
    </div>
  );
}

function PayButton({ ws, overage: o }: { ws: string; overage: Overage }) {
  const t = useTranslations("billing.overage");
  const errorMessage = useErrorMessage();
  const pay = useStartOverageCheckout(ws);
  const [key] = useState(newIdempotencyKey);
  const redirecting = pay.isPending || pay.isSuccess;
  return (
    <div className="space-y-1">
      <Button size="sm" variant={o.blocked ? "danger" : "primary"} loading={redirecting} onClick={() => pay.mutate(key)}>
        <CreditCard aria-hidden />
        {redirecting ? t("redirecting") : t("pay", { amount: formatToman(rialOf(o.due) ?? 0) })}
      </Button>
      {pay.isError ? (
        <p role="alert" className="text-xs text-danger">
          {errorMessage(pay.error)}
        </p>
      ) : null}
    </div>
  );
}

function Charges({ ws }: { ws: string }) {
  const t = useTranslations("billing.overage");
  const errorMessage = useErrorMessage();
  const charges = useOverageCharges(ws);
  return (
    <div className="border-t">
      <h3 className="px-4 pt-4 text-sm font-semibold sm:px-5">{t("chargesTitle")}</h3>
      {charges.isPending ? (
        <Skeleton className="m-4 h-12" />
      ) : charges.isError ? (
        <p className="p-4 text-sm text-danger">{errorMessage(charges.error)}</p>
      ) : charges.data.length === 0 ? (
        <EmptyState title={t("chargesEmpty")} className="py-6" />
      ) : (
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-start">
                <th scope="col" className="py-1.5 text-start font-medium">{t("colPeriod")}</th>
                <th scope="col" className="py-1.5 text-start font-medium">{t("colConversations")}</th>
                <th scope="col" className="py-1.5 text-start font-medium">{t("colUnit")}</th>
                <th scope="col" className="py-1.5 text-start font-medium">{t("colAmount")}</th>
                <th scope="col" className="py-1.5 text-start font-medium">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {charges.data.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">{t("periodShort", { from: formatDate(c.periodStart), to: formatDate(c.periodEnd) })}</td>
                  <td className="py-2 tabular-nums">{formatNumber(c.conversations)}</td>
                  <td className="py-2 tabular-nums">{formatToman(rialOf(c.unitPrice) ?? 0)}</td>
                  <td className="py-2 font-medium tabular-nums">{formatToman(rialOf(c.amount) ?? 0)}</td>
                  <td className="py-2">
                    <Badge tone={c.status === "settled" ? "success" : "warning"}>{t.has(`chargeStatuses.${c.status}`) ? t(`chargeStatuses.${c.status}` as "chargeStatuses.due") : c.status}</Badge>
                    {c.settledAt ? <span className="ms-1 text-xs text-muted-foreground">{formatDateTime(c.settledAt)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
