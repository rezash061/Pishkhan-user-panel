"use client";

import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { BankAccount, ReceiptSettings } from "@/lib/api/types";
import { cleanCard, cleanSheba, formatCard, isValidCard, isValidSheba } from "@/lib/bank";
import { toLatinDigits, toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { RIAL_PER_TOMAN } from "@/lib/money";
import { P } from "@/lib/permissions";
import { receiptLimits, useBankAccounts, useDeleteBankAccount, useReceiptSettings, useSaveBankAccount, useSaveReceiptSettings } from "./data";

/** «کارت‌ها و شباها» (UP-2.2, backend #50): the accounts card-to-card receipts are matched against. */
export function BankAccounts() {
  const t = useTranslations("payments.bank");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.settingsWrite);
  const accounts = useBankAccounts(workspace.id);
  const remove = useDeleteBankAccount(workspace.id);
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);
  const items = accounts.data ?? [];

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("hint")}
        action={
          writable && items.length < receiptLimits.accounts ? (
            <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        {accounts.isPending ? (
          <Skeleton className="h-20" />
        ) : accounts.isError ? (
          <p className="text-sm text-danger">{errorMessage(accounts.error)}</p>
        ) : items.length === 0 ? (
          <EmptyState icon={<Landmark aria-hidden />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.bankName ?? t("unknownBank")}
                    {!a.enabled ? <Badge>{t("paused")}</Badge> : null}
                  </p>
                  {a.cardNumber ? (
                    <p className="text-muted-foreground">
                      {t("card")}:{" "}
                      <span dir="ltr" className="font-mono">
                        {formatCard(a.cardNumber)}
                      </span>
                    </p>
                  ) : null}
                  {a.sheba ? (
                    <p className="text-muted-foreground">
                      {t("sheba")}:{" "}
                      <span dir="ltr" className="font-mono break-all">
                        {a.sheba}
                      </span>
                    </p>
                  ) : null}
                  {a.holderName ? <p className="text-muted-foreground">{a.holderName}</p> : null}
                </div>
                {writable ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(a)} aria-label={t("editOf", { name: a.bankName ?? t("unknownBank") })}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => setDeleting(a)} aria-label={t("deleteOf", { name: a.bankName ?? t("unknownBank") })}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!writable ? <p className="text-sm text-muted-foreground">{t("readOnly")}</p> : null}
        {writable && items.length >= receiptLimits.accounts ? <p className="text-xs text-muted-foreground">{t("limit", { count: receiptLimits.accounts })}</p> : null}
      </CardBody>
      {editing ? <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteTitle")}
        body={t("deleteBody")}
        confirmLabel={t("delete")}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(t("deleted"));
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </Card>
  );
}

/** What is wrong with the typed card and Sheba, checked like the backend (Luhn, mod 97) before sending. */
export function accountErrors(card: string, sheba: string): { card?: "cardInvalid"; sheba?: "shebaInvalid"; both?: "required" } {
  const hasCard = card.trim().length > 0;
  const hasSheba = sheba.trim().length > 0;
  if (!hasCard && !hasSheba) return { both: "required" };
  return { ...(hasCard && !isValidCard(card) ? { card: "cardInvalid" as const } : {}), ...(hasSheba && !isValidSheba(sheba) ? { sheba: "shebaInvalid" as const } : {}) };
}

function AccountDialog({ account, onClose }: { account: BankAccount | null; onClose: () => void }) {
  const t = useTranslations("payments.bank");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const save = useSaveBankAccount(workspace.id);
  const [card, setCard] = useState(account?.cardNumber ? formatCard(account.cardNumber) : "");
  const [sheba, setSheba] = useState(account?.sheba ?? "");
  const [holder, setHolder] = useState(account?.holderName ?? "");
  const [enabled, setEnabled] = useState(account?.enabled ?? true);
  const [errors, setErrors] = useState<{ card?: string; sheba?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = accountErrors(card, sheba);
    if (found.both) return setErrors({ card: t(found.both) });
    if (found.card || found.sheba) return setErrors({ card: found.card && t(found.card), sheba: found.sheba && t(found.sheba) });
    setErrors({});
    save.mutate(
      { id: account?.id, body: { cardNumber: card.trim() ? cleanCard(card) : null, sheba: sheba.trim() ? cleanSheba(sheba) : null, holderName: holder.trim() || null, enabled } },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            const cardCode = err.field("cardNumber");
            const shebaCode = err.field("sheba");
            if (cardCode || shebaCode) return setErrors({ card: cardCode ? (codeMessage(cardCode) ?? t("cardInvalid")) : undefined, sheba: shebaCode ? (codeMessage(shebaCode) ?? t("shebaInvalid")) : undefined });
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      title={account ? t("dialogEdit") : t("dialogAdd")}
      description={t("dialogHint")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="bank-account-form" loading={save.isPending}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <form id="bank-account-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t("card")} htmlFor="bank-card" error={errors.card} hint={t("cardHint")}>
          <Input
            id="bank-card"
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            maxLength={24}
            className="font-mono"
            placeholder="6037-9912-3456-7893"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            aria-invalid={Boolean(errors.card) || undefined}
          />
        </Field>
        <Field label={t("sheba")} htmlFor="bank-sheba" error={errors.sheba} hint={t("shebaHint")}>
          <Input
            id="bank-sheba"
            dir="ltr"
            autoComplete="off"
            maxLength={34}
            className="font-mono"
            placeholder="IR000000000000000000000000"
            value={sheba}
            onChange={(e) => setSheba(e.target.value)}
            aria-invalid={Boolean(errors.sheba) || undefined}
          />
        </Field>
        <Field label={t("holder")} htmlFor="bank-holder">
          <Input id="bank-holder" maxLength={100} value={holder} onChange={(e) => setHolder(e.target.value)} />
        </Field>
        <div className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
          <span>
            <span className="block font-medium">{t("enabled")}</span>
            <span className="text-xs text-muted-foreground">{t("enabledHint")}</span>
          </span>
          <Switch checked={enabled} onChange={setEnabled} label={t("enabled")} />
        </div>
      </form>
    </Dialog>
  );
}

/** «بررسی رسیدها» (UP-2.3): auto-approve (only where the platform allows it) and the checks' tolerances. */
export function ReceiptSettingsCard() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const settings = useReceiptSettings(workspace.id);
  if (settings.isPending) return <Skeleton className="h-64" />;
  if (settings.isError) return <p className="text-sm text-danger">{errorMessage(settings.error)}</p>;
  return <ReceiptSettingsForm settings={settings.data} />;
}

/** Percent typed in any digits, 80–100; null when it is not a number in range. */
export function parseThreshold(text: string): number | null {
  const n = Number(toLatinDigits(text).trim());
  return Number.isFinite(n) && n >= receiptLimits.minThreshold * 100 && n <= 100 && text.trim() !== "" ? n / 100 : null;
}

function ReceiptSettingsForm({ settings }: { settings: ReceiptSettings }) {
  const t = useTranslations("payments.receiptSettings");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.settingsWrite);
  const save = useSaveReceiptSettings(workspace.id);
  const [autoApprove, setAutoApprove] = useState(settings.autoApprove);
  const [confirming, setConfirming] = useState(false);
  const [threshold, setThreshold] = useState(toPersianDigits(Math.round(settings.threshold * 100)));
  const [tolerance, setTolerance] = useState<number | null>(Math.round((settings.amountTolerance.amount ?? 0) / RIAL_PER_TOMAN));
  const [windowHours, setWindowHours] = useState(toPersianDigits(settings.windowHours));

  const thresholdValue = parseThreshold(threshold);
  const toleranceRial = (tolerance ?? 0) * RIAL_PER_TOMAN;
  const toleranceOk = toleranceRial >= 0 && toleranceRial <= receiptLimits.maxToleranceRial;
  const hours = Number(toLatinDigits(windowHours).trim());
  const hoursOk = Number.isInteger(hours) && hours >= 1 && hours <= receiptLimits.maxWindowHours;
  const valid = thresholdValue !== null && toleranceOk && hoursOk;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    save.mutate(
      { autoApprove: autoApprove && settings.autoApproveAvailable, threshold: thresholdValue, amountTolerance: toleranceRial, windowHours: hours },
      { onSuccess: () => toast.success(t("saved")), onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  const toggle = (on: boolean) => (on ? setConfirming(true) : setAutoApprove(false));

  return (
    <Card>
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium">{t("autoApprove")}</span>
                <span className="text-xs text-muted-foreground">{t("autoApproveHint")}</span>
              </span>
              <Switch checked={autoApprove && settings.autoApproveAvailable} onChange={toggle} label={t("autoApprove")} disabled={!writable || !settings.autoApproveAvailable} />
            </div>
            {!settings.autoApproveAvailable ? (
              <p role="note" className="rounded-lg bg-surface-muted p-2 text-xs">
                {t("unavailable")}
              </p>
            ) : null}
          </div>
          <Field label={t("threshold")} htmlFor="receipt-threshold" hint={t("thresholdHint")} error={thresholdValue === null ? t("thresholdInvalid") : undefined}>
            <Input
              id="receipt-threshold"
              inputMode="numeric"
              maxLength={3}
              value={threshold}
              disabled={!writable}
              onChange={(e) => setThreshold(e.target.value)}
              aria-invalid={thresholdValue === null || undefined}
            />
          </Field>
          <Field label={t("tolerance")} htmlFor="receipt-tolerance" hint={t("toleranceHint")} error={!toleranceOk ? t("toleranceInvalid", { max: formatNumber(receiptLimits.maxToleranceRial / RIAL_PER_TOMAN) }) : undefined}>
            <MoneyInput id="receipt-tolerance" value={tolerance} onChange={setTolerance} disabled={!writable} invalid={!toleranceOk} />
          </Field>
          <Field label={t("window")} htmlFor="receipt-window" hint={t("windowHint")} error={!hoursOk ? t("windowInvalid") : undefined}>
            <Input id="receipt-window" inputMode="numeric" maxLength={3} value={windowHours} disabled={!writable} onChange={(e) => setWindowHours(e.target.value)} aria-invalid={!hoursOk || undefined} />
          </Field>
          {writable ? (
            <Button type="submit" loading={save.isPending} disabled={!valid}>
              {t("save")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
          )}
        </form>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("confirmTitle")}
        body={t("confirmBody")}
        confirmLabel={t("confirm")}
        onConfirm={() => {
          setAutoApprove(true);
          setConfirming(false);
        }}
      />
    </Card>
  );
}
