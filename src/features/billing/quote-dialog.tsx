"use client";

import { CreditCard, TicketPercent, Wallet as WalletIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { ApiError } from "@/lib/api/errors";
import type { PublicPlan } from "@/lib/api/types";
import { formatDateTime, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { breakdown, isCouponError, normalizeCoupon, type CheckoutKind, type Cycle } from "./checkout";
import { newIdempotencyKey, useCheckoutQuote, useStartCheckout, useTryCoupon, useWallet } from "./data";

/**
 * The quote step: what buying the plan costs now (price, the credit an upgrade gets, a coupon's discount, what the wallet
 * pays, and the amount left for Zarinpal) and when the period starts and ends. «پرداخت» opens the checkout with one
 * Idempotency-Key per coupon and wallet choice, so a double tap opens one payment. When the coupon and the wallet cover
 * it all, the plan is bought at once without the gateway.
 */
export function QuoteDialog({ ws, plan, cycle, kind, onClose }: { ws: string; plan: PublicPlan; cycle: Cycle; kind: CheckoutKind; onClose: () => void }) {
  const t = useTranslations("billing.quote");
  const tp = useTranslations("billing.plans");
  const tc = useTranslations("billing.cycle");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const extras = { couponCode, useWallet: useWalletBalance };
  const quote = useCheckoutQuote(ws, plan.id, cycle, extras);
  const wallet = useWallet(ws);
  const start = useStartCheckout(ws);
  const [keys] = useState(() => new Map<string, string>());
  const keyFor = () => {
    const id = `${couponCode ?? ""}|${useWalletBalance}`;
    if (!keys.has(id)) keys.set(id, newIdempotencyKey());
    return keys.get(id)!;
  };
  const q = quote.data;
  // The quote may say otherwise than the list did (the subscription changed in between); the quote wins.
  const shownKind = (q?.kind as CheckoutKind | undefined) ?? kind;
  const b = q ? breakdown(q) : null;
  const startsNow = shownKind === "new" || shownKind === "upgrade";
  const redirecting = start.isPending || start.isSuccess;
  const balance = rialOf(wallet.data?.balance) ?? 0;
  const updating = quote.isFetching;

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
            onClick={() => q && start.mutate({ planId: plan.id, cycle, extras, idempotencyKey: keyFor() })}
            disabled={!q || updating}
            loading={redirecting}
          >
            {b?.covered ? <WalletIcon aria-hidden /> : <CreditCard aria-hidden />}
            {redirecting ? (b?.covered ? t("activating") : t("redirecting")) : b?.covered ? t("payCovered") : t("pay", { amount: formatToman(b?.amount ?? 0) })}
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
      ) : !q || !b ? (
        <div role="alert" className="space-y-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <p>{errorMessage(quote.error)}</p>
          {couponCode && quote.error instanceof ApiError && isCouponError(quote.error.code) ? (
            <Button variant="outline" size="sm" onClick={() => setCouponCode(null)}>
              {t("couponRemove")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <dl className="divide-y rounded-xl border" aria-busy={updating || undefined}>
            <Row label={t("price", { cycle: tc(q.cycle === "annual" ? "annualLong" : "monthlyLong") })} value={formatToman(b.price)} />
            {b.credit > 0 ? <Row label={t("credit")} value={`− ${formatToman(b.credit)}`} tone="success" /> : null}
            {b.discount > 0 ? <Row label={t("discount", { code: q.couponCode ?? "" })} value={`− ${formatToman(b.discount)}`} tone="success" /> : null}
            {b.walletUsed > 0 ? <Row label={t("walletUsed")} value={`− ${formatToman(b.walletUsed)}`} tone="success" /> : null}
            <Row label={b.covered ? t("amountCovered") : t("amount")} value={formatToman(b.amount)} strong />
            <Row label={t("starts")} value={startsNow ? t("startsNow") : formatDateTime(q.startsAt)} />
            <Row label={t("ends")} value={formatDateTime(q.endsAt)} />
          </dl>

          <CouponField
            ws={ws}
            planId={plan.id}
            cycle={cycle}
            applied={q.couponCode ?? couponCode}
            useWallet={useWalletBalance}
            disabled={redirecting}
            onApply={setCouponCode}
          />

          {balance > 0 ? (
            <div className="space-y-1 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="quote-wallet" className="inline-flex items-center gap-1.5 font-medium">
                  <WalletIcon className="size-4 text-primary" aria-hidden />
                  {t("useWallet", { balance: formatToman(balance) })}
                </label>
                <Switch
                  id="quote-wallet"
                  label={t("useWallet", { balance: formatToman(balance) })}
                  checked={useWalletBalance}
                  onChange={setUseWalletBalance}
                  disabled={redirecting}
                />
              </div>
              {useWalletBalance && b.walletUsed < Math.min(balance, b.price - b.credit - b.discount) ? (
                <p className="text-xs text-muted-foreground">{t("walletKeptForMinimum")}</p>
              ) : null}
            </div>
          ) : null}

          {b.minimumApplied ? <p className="text-xs text-muted-foreground">{t("minimum")}</p> : null}
          <p className="text-xs text-muted-foreground">{b.covered ? t("covered") : t("gateway")}</p>
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

/**
 * «کد تخفیف»: a link that opens the field. A code is tried on the quote first; a refused one is told under the field
 * and the quote stays as it was. An applied code shows as a chip that can be removed.
 */
function CouponField({
  ws,
  planId,
  cycle,
  applied,
  useWallet,
  disabled,
  onApply,
}: {
  ws: string;
  planId: string;
  cycle: Cycle;
  applied: string | null;
  useWallet: boolean;
  disabled: boolean;
  onApply: (code: string | null) => void;
}) {
  const t = useTranslations("billing.quote");
  const errorMessage = useErrorMessage();
  const tryCoupon = useTryCoupon(ws, planId, cycle);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const code = normalizeCoupon(text);

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-success/60 bg-success-soft/40 p-3">
        <p className="inline-flex items-center gap-1.5">
          <TicketPercent className="size-4 text-[oklch(0.45_0.12_155)] dark:text-success" aria-hidden />
          {t("couponApplied")}{" "}
          <bdi dir="ltr" className="font-mono font-semibold">
            {applied}
          </bdi>
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onApply(null);
            setText("");
            tryCoupon.reset();
          }}
        >
          <X aria-hidden />
          {t("couponRemove")}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" onClick={() => setOpen(true)} disabled={disabled}>
        <TicketPercent className="size-4" aria-hidden />
        {t("couponLink")}
      </button>
    );
  }

  const apply = () => {
    if (code.length < 3) return;
    tryCoupon.mutate({ couponCode: code, useWallet }, { onSuccess: (q) => onApply(q.couponCode ?? code) });
  };

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label htmlFor="quote-coupon" className="text-sm font-medium">
        {t("couponLabel")}
      </label>
      <div className="flex gap-2">
        <Input
          id="quote-coupon"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          placeholder="NOROOZ1405"
          value={text}
          aria-invalid={tryCoupon.isError || undefined}
          aria-describedby={tryCoupon.isError ? "quote-coupon-error" : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (tryCoupon.isError) tryCoupon.reset();
          }}
          className="font-mono uppercase"
          autoFocus
          disabled={disabled}
        />
        <Button type="submit" variant="outline" loading={tryCoupon.isPending} disabled={disabled || code.length < 3}>
          {t("couponApply")}
        </Button>
      </div>
      {tryCoupon.isError ? (
        <p id="quote-coupon-error" role="alert" className="text-xs text-danger">
          {errorMessage(tryCoupon.error)}
        </p>
      ) : null}
    </form>
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
