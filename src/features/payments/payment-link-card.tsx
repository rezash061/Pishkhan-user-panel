"use client";

import { Copy, Link2, Share2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Order, PaymentLink } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { newIdempotencyKey, useCancelPaymentLink, useCreatePaymentLink, usePaymentLinks } from "./data";

const tones = { active: "primary", paid: "success", cancelled: "neutral", expired: "neutral" } as const;
const payable = new Set(["draft", "awaiting_payment"]);

/**
 * «لینک پرداخت» on the order page (BE-2.2): make a Zarinpal link for the order total, copy or share it with the customer,
 * and watch it; when the customer pays, the backend marks the order paid on its own.
 */
export function PaymentLinkCard({ order: o }: { order: Order }) {
  const t = useTranslations("payments.link");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const links = usePaymentLinks(ws, o.id);
  const create = useCreatePaymentLink(ws, o.id);
  const [key, setKey] = useState(newIdempotencyKey);
  const [merchantMissing, setMerchantMissing] = useState(false);
  const writable = can(P.ordersWrite);
  const list = links.data ?? [];
  const active = list.find((l) => l.status === "active") ?? null;
  const shown = active ?? (list[0]?.status === "paid" ? list[0] : null);
  const past = list.filter((l) => l !== shown);

  // Nothing to show for an order that can no longer be paid and never had a link.
  if (!payable.has(o.status) && list.length === 0 && !links.isPending) return null;

  const make = () => {
    setMerchantMissing(false);
    create.mutate(key, {
      onSuccess: () => {
        setKey(newIdempotencyKey());
        toast.success(t("created"));
      },
      onError: (err) => {
        setKey(newIdempotencyKey());
        if (err instanceof ApiError && err.code === "payments.merchant_missing") return setMerchantMissing(true);
        toast.error(errorMessage(err));
      },
    });
  };

  return (
    <Card className="h-fit">
      <CardHeader title={t("title")} />
      <CardBody className="space-y-3">
        {links.isPending ? (
          <Skeleton className="h-16" />
        ) : active ? (
          <ActiveLink link={active} orderId={o.id} writable={writable} />
        ) : list[0]?.status === "paid" ? (
          <div className="space-y-1 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{t("status.paid")}</Badge>
              <span className="font-medium">{formatToman(rialOf(list[0].amount) ?? 0)}</span>
            </p>
            <PaidDetails link={list[0]} />
          </div>
        ) : payable.has(o.status) ? (
          <p className="text-sm text-muted-foreground">{o.status === "draft" ? t("hintDraft") : t("hintAwaiting")}</p>
        ) : null}

        {merchantMissing ? (
          <p role="alert" className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
            {t("merchantMissing")}{" "}
            {can(P.settingsWrite) ? (
              <Link href={`/w/${ws}/settings/payments`} className="text-primary underline underline-offset-2">
                {t("connectMerchant")}
              </Link>
            ) : (
              t("askOwner")
            )}
          </p>
        ) : null}

        {writable && payable.has(o.status) ? (
          <Button variant={active ? "outline" : "primary"} className="w-full" loading={create.isPending} onClick={make}>
            <Link2 aria-hidden />
            {active ? t("renew") : t("create")}
          </Button>
        ) : null}
        {active && writable && payable.has(o.status) ? <p className="text-xs text-muted-foreground">{t("renewHint")}</p> : null}

        {past.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("history", { n: toPersianDigits(past.length) })}</summary>
            <ul className="mt-2 space-y-2">
              {past.map((l) => (
                <li key={l.id} className="rounded-xl border p-2.5">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={tones[l.status as keyof typeof tones] ?? "neutral"}>{t.has(`status.${l.status}`) ? t(`status.${l.status}` as "status.paid") : l.status}</Badge>
                    <span>{formatToman(rialOf(l.amount) ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(l.createdAt)}</span>
                  </p>
                  {l.status === "paid" ? <PaidDetails link={l} /> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ActiveLink({ link: l, orderId, writable }: { link: PaymentLink; orderId: string; writable: boolean }) {
  const t = useTranslations("payments.link");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const cancel = useCancelPaymentLink(workspace.id, orderId);
  const [confirming, setConfirming] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(l.url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="primary">{t("status.active")}</Badge>
        <span className="font-medium">{formatToman(rialOf(l.amount) ?? 0)}</span>
      </p>
      <label htmlFor={`pay-url-${l.id}`} className="sr-only">
        {t("url")}
      </label>
      <input id={`pay-url-${l.id}`} readOnly dir="ltr" value={l.url} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full rounded-xl border bg-surface-muted px-3 font-mono text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        {canShare ? (
          <Button size="sm" variant="secondary" onClick={() => void navigator.share({ url: l.url, title: t("shareTitle") }).catch(() => undefined)}>
            <Share2 aria-hidden />
            {t("share")}
          </Button>
        ) : null}
        {writable ? (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirming(true)}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("expires", { when: formatDateTime(l.expiresAt) })}
        {l.attempts > 0 ? ` · ${t("attempts", { n: toPersianDigits(l.attempts) })}` : null}
        {l.lastError ? ` · ${l.lastError === "cancelled" ? t("lastCancelled") : t("lastError", { code: toPersianDigits(l.lastError) })}` : null}
      </p>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        danger
        title={t("cancelTitle")}
        body={t("cancelBody")}
        confirmLabel={t("cancel")}
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(l.id, {
            onSuccess: () => {
              setConfirming(false);
              toast.success(t("cancelled"));
            },
            onError: (err) => {
              setConfirming(false);
              toast.error(errorMessage(err));
            },
          })
        }
      />
    </div>
  );
}

function PaidDetails({ link: l }: { link: PaymentLink }) {
  const t = useTranslations("payments.link");
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {[l.paidAt ? t("paidAt", { when: formatDateTime(l.paidAt) }) : null, l.referenceId ? t("reference", { ref: toPersianDigits(l.referenceId) }) : null, l.cardMask ? t("card", { card: l.cardMask }) : null].filter(Boolean).join(" · ")}
    </p>
  );
}
