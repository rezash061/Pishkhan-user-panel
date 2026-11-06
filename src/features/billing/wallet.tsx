"use client";

import { ArrowDownLeft, ArrowUpRight, CreditCard, Plus, Wallet as WalletIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/misc";
import type { WalletEntry } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { topUpPresetsToman, topUpRial, TOP_UP_MAX_TOMAN, TOP_UP_MIN_TOMAN, walletEntryKinds } from "./checkout";
import { newIdempotencyKey, useWallet, useWalletTopUp } from "./data";

const SHOWN = 5;

/**
 * «کیف پول» (BE-1.11): the prepaid balance, a top-up through Zarinpal, and the latest changes. The balance can pay all or
 * part of a plan at checkout.
 */
export function WalletCard({ ws }: { ws: string }) {
  const t = useTranslations("billing.wallet");
  const errorMessage = useErrorMessage();
  const wallet = useWallet(ws);
  const [topUp, setTopUp] = useState(false);
  const [all, setAll] = useState(false);
  const entries = wallet.data?.entries ?? [];
  const shown = all ? entries : entries.slice(0, SHOWN);

  return (
    <Card id="wallet" className="scroll-mt-4">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <WalletIcon className="size-4 text-primary" aria-hidden />
            {t("title")}
          </span>
        }
        description={t("subtitle")}
        action={
          <Button size="sm" onClick={() => setTopUp(true)} disabled={!wallet.data}>
            <Plus aria-hidden />
            {t("topUp")}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {wallet.isPending ? (
          <Skeleton className="h-20" />
        ) : wallet.isError ? (
          <p className="text-sm text-danger">{errorMessage(wallet.error)}</p>
        ) : (
          <>
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="text-xs text-muted-foreground">{t("balance")}</p>
              <p className="text-2xl font-bold tabular-nums" data-testid="wallet-balance">
                {formatToman(rialOf(wallet.data.balance) ?? 0)}
              </p>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("entries")}</p>
                <ul className="divide-y rounded-xl border">
                  {shown.map((e) => (
                    <EntryRow key={e.id} ws={ws} entry={e} />
                  ))}
                </ul>
                {entries.length > SHOWN ? (
                  <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
                    {all ? t("showLess") : t("showAll", { count: formatNumber(entries.length) })}
                  </Button>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardBody>
      {topUp ? <TopUpDialog ws={ws} onClose={() => setTopUp(false)} /> : null}
    </Card>
  );
}

function EntryRow({ ws, entry: e }: { ws: string; entry: WalletEntry }) {
  const t = useTranslations("billing.wallet");
  const amount = rialOf(e.amount) ?? 0;
  const kind = (walletEntryKinds as readonly string[]).includes(e.kind) ? t(`kinds.${e.kind as (typeof walletEntryKinds)[number]}`) : e.kind;
  const incoming = amount >= 0;
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  const body = (
    <>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", incoming ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{kind}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatDateTime(e.createdAt)}
          {e.reason ? ` · ${e.reason}` : null}
        </span>
      </span>
      <span className="text-end">
        <span className={cn("block text-sm font-semibold tabular-nums", incoming && "text-[oklch(0.45_0.12_155)] dark:text-success")}>
          {incoming ? "+" : "−"} {formatToman(Math.abs(amount))}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">{t("after", { balance: formatToman(rialOf(e.balanceAfter) ?? 0) })}</span>
      </span>
    </>
  );
  return (
    <li>
      {e.checkoutId ? (
        <Link href={`/w/${ws}/billing/checkouts/${e.checkoutId}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-muted">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
      )}
    </li>
  );
}

/** Pick or type an amount in Toman; «پرداخت» opens Zarinpal, and the balance grows when it confirms. */
function TopUpDialog({ ws, onClose }: { ws: string; onClose: () => void }) {
  const t = useTranslations("billing.wallet");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const topUp = useWalletTopUp(ws);
  const [toman, setToman] = useState<number | null>(topUpPresetsToman[1] ?? null);
  const [touched, setTouched] = useState(false);
  const checked = topUpRial(toman);
  const error = "error" in checked ? checked.error : null;
  const redirecting = topUp.isPending || topUp.isSuccess;
  // One Idempotency-Key per amount, so a double tap opens one payment and a changed amount opens a new one.
  const [keys] = useState(() => new Map<number, string>());

  const submit = () => {
    setTouched(true);
    if ("rial" in checked) {
      if (!keys.has(checked.rial)) keys.set(checked.rial, newIdempotencyKey());
      topUp.mutate({ amount: checked.rial, idempotencyKey: keys.get(checked.rial)! });
    }
  };

  return (
    <Dialog
      open
      onClose={redirecting ? () => undefined : onClose}
      variant="sheet"
      title={t("topUpTitle")}
      description={t("topUpBody")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={redirecting}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} loading={redirecting} disabled={touched && !!error}>
            <CreditCard aria-hidden />
            {redirecting ? t("redirecting") : "rial" in checked ? t("pay", { amount: formatToman(checked.rial) }) : t("payEmpty")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t("presets")}>
          {topUpPresetsToman.map((p) => (
            <Button
              key={p}
              type="button"
              variant={toman === p ? "primary" : "outline"}
              size="sm"
              aria-pressed={toman === p}
              onClick={() => setToman(p)}
              disabled={redirecting}
            >
              {formatToman(p * 10)}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="top-up-amount" className="text-sm font-medium">
            {t("amount")}
          </label>
          <MoneyInput id="top-up-amount" value={toman} onChange={setToman} invalid={touched && !!error} disabled={redirecting} />
          {touched && error ? (
            <p role="alert" className="text-xs text-danger">
              {t(`errors.${error}`, { min: formatToman(TOP_UP_MIN_TOMAN * 10), max: formatToman(TOP_UP_MAX_TOMAN * 10) })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("limits", { min: formatToman(TOP_UP_MIN_TOMAN * 10), max: formatToman(TOP_UP_MAX_TOMAN * 10) })}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("gateway")}</p>
        {topUp.isError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {errorMessage(topUp.error)}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
