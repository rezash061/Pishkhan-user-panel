import type { BillingPlanOption, Checkout, CheckoutQuote, CurrentPlan, PublicPlan, Subscription } from "@/lib/api/types";
import { rialOf } from "@/lib/money";

/** Billing cycles the backend sells: `monthly` (30 days, the default) and `annual` (365 days). */
export type Cycle = "monthly" | "annual";
export const cycles: Cycle[] = ["monthly", "annual"];

/** What buying a plan would be (backend `CheckoutKinds`). */
export type CheckoutKind = "new" | "renewal" | "upgrade" | "downgrade";
export const checkoutKinds: CheckoutKind[] = ["new", "renewal", "upgrade", "downgrade"];

/** A checkout's status (backend `CheckoutStatuses`); `expired` is a pending one not paid within an hour. */
export type CheckoutStatus = "pending" | "paid" | "failed" | "expired";

/** Every error code BE-2.8 can answer the plans, quote and checkout endpoints with; each has a Persian message under `errors`. */
export const checkoutErrorCodes = [
  "billing.plan.not_found",
  "billing.checkout.plan_not_for_sale",
  "billing.checkout.cycle_not_offered",
  "billing.checkout.cycle_invalid",
  "billing.checkout.unavailable",
  "billing.checkout.gateway_unavailable",
  "billing.checkout.managed_subscription",
  "billing.checkout.scheduled_pending",
] as const;

/** Why a coupon cannot be used (BE-1.11); shown under the coupon field, the quote without the coupon stays. */
export const couponErrorCodes = [
  "billing.coupon.invalid",
  "billing.coupon.expired",
  "billing.coupon.used_up",
  "billing.coupon.not_for_plan",
  "billing.coupon.first_purchase_only",
  "billing.coupon.already_used",
] as const;

export const isCouponError = (code: string | null | undefined) => !!code && code.startsWith("billing.coupon.");

/** Zarinpal's smallest payment (backend `CheckoutPlanner.MinimumAmount`), 1,000 Toman. */
export const MINIMUM_RIAL = 10_000;

/** Coupon codes are 3–32 letters, digits, `-` or `_`; the backend compares them in upper case. */
export function normalizeCoupon(raw: string): string {
  return raw.trim().toUpperCase();
}

const rial = (m: { amount?: number | string | null } | null | undefined) => Number(m?.amount ?? 0);

/** How the quote's amount comes about, in Rial: what is left after credit, coupon and wallet, and the Zarinpal amount. */
export function breakdown(q: Pick<CheckoutQuote, "price" | "credit" | "discount" | "walletUsed" | "amount">) {
  const price = rial(q.price);
  const credit = rial(q.credit);
  const discount = rial(q.discount);
  const walletUsed = rial(q.walletUsed);
  const amount = rial(q.amount);
  const left = Math.max(0, price - credit - discount - walletUsed);
  return {
    price,
    credit,
    discount,
    walletUsed,
    amount,
    /** Nothing goes to Zarinpal: the coupon and the wallet paid it all. */
    covered: amount === 0,
    /** Zarinpal's minimum was charged instead of a smaller amount. */
    minimumApplied: amount === MINIMUM_RIAL && left < MINIMUM_RIAL,
  };
}

/** Wallet top-ups (backend `CheckoutService.MinTopUp`/`MaxTopUp`): 10,000 to 100,000,000 Toman. */
export const TOP_UP_MIN_TOMAN = 10_000;
export const TOP_UP_MAX_TOMAN = 100_000_000;
export const topUpPresetsToman = [100_000, 500_000, 1_000_000, 2_000_000];

/** The Rial amount for a typed Toman top-up, or the reason it is refused. */
export function topUpRial(toman: number | null): { rial: number } | { error: "required" | "min" | "max" } {
  if (toman === null || !Number.isFinite(toman) || toman <= 0) return { error: "required" };
  if (toman < TOP_UP_MIN_TOMAN) return { error: "min" };
  if (toman > TOP_UP_MAX_TOMAN) return { error: "max" };
  return { rial: Math.round(toman) * 10 };
}

/** Wallet changes (backend `WalletEntryKinds`). */
export const walletEntryKinds = ["top_up", "adjustment", "refund", "checkout", "released"] as const;

/** The plan's price for a cycle in Rial, or null when the plan is not sold for that cycle (no price, or zero). */
export function priceOf(plan: PublicPlan, cycle: Cycle): number | null {
  const rial = rialOf(cycle === "annual" ? plan.annual : plan.monthly);
  return rial !== null && rial > 0 ? rial : null;
}

/** Cycles the plan can be bought for, in display order. */
export function cyclesOf(plan: PublicPlan): Cycle[] {
  return cycles.filter((c) => priceOf(plan, c) !== null);
}

/**
 * The cycle to quote a plan for: the one picked on the page when the plan has it, otherwise the plan's only cycle.
 * Null for a plan that has no price at all (the free plan).
 */
export function cycleFor(plan: PublicPlan, picked: Cycle): Cycle | null {
  const offered = cyclesOf(plan);
  if (offered.includes(picked)) return picked;
  return offered[0] ?? null;
}

/** Whole percent an annual payment saves against twelve monthly ones, or null when there is nothing to compare or no saving. */
export function annualSaving(plan: PublicPlan): number | null {
  const monthly = priceOf(plan, "monthly");
  const annual = priceOf(plan, "annual");
  if (monthly === null || annual === null) return null;
  const saving = Math.round((1 - annual / (monthly * 12)) * 100);
  return saving > 0 ? saving : null;
}

/** Whether any plan on sale has an annual price; the page hides the cycle toggle otherwise. */
export function offersAnnual(options: BillingPlanOption[]): boolean {
  return options.some((o) => priceOf(o.plan, "annual") !== null);
}

/**
 * The cycle the page starts on: the current subscription's cycle when it was bought, so a renewal is quoted the way it
 * was paid, otherwise monthly.
 */
export function initialCycle(current: CurrentPlan | undefined): Cycle {
  return current?.subscription?.cycle === "annual" ? "annual" : "monthly";
}

/** Overage payments (BE-2.8) are checkouts too, of kind `overage`, with no subscription. */
export const isOverage = (kind: string | null | undefined) => kind === "overage";

/** Money into the wallet (BE-1.11) is a checkout of kind `wallet_top_up`, with no plan. */
export const isWalletTopUp = (kind: string | null | undefined) => kind === "wallet_top_up";

/** Checkouts that buy no plan: no cycle, no subscription. */
export const isPlanless = (kind: string | null | undefined) => isOverage(kind) || isWalletTopUp(kind);

export function isKind(value: string | null | undefined): value is CheckoutKind {
  return checkoutKinds.includes(value as CheckoutKind);
}

/** How a checkout ended, for the return page: a failed one is told apart when the payer left the gateway. */
export type Outcome = "paid" | "pending" | "failed" | "cancelled" | "expired";

export function outcomeOf(checkout: Pick<Checkout, "status" | "error">): Outcome {
  switch (checkout.status) {
    case "paid":
      return "paid";
    case "expired":
      return "expired";
    case "failed":
      return checkout.error === "cancelled" ? "cancelled" : "failed";
    default:
      return "pending";
  }
}

export const statusTone = { paid: "success", pending: "warning", failed: "danger", expired: "neutral" } as const;

export function toneOf(status: string): (typeof statusTone)[keyof typeof statusTone] {
  return statusTone[status as CheckoutStatus] ?? "neutral";
}

/** A plan's display name by code (subscriptions only carry the code), falling back to the code itself. */
export function planName(options: BillingPlanOption[] | undefined, code: string): string {
  return options?.find((o) => o.plan.code === code)?.plan.name ?? code;
}

/** The subscription a paid checkout bought, when it is the current one or one of the upcoming periods. */
export function subscriptionOf(current: CurrentPlan | undefined, checkout: Pick<Checkout, "id" | "subscriptionId">): Subscription | null {
  if (!current) return null;
  const all = [current.subscription, ...(current.upcoming ?? [])].filter((s): s is Subscription => s != null);
  return all.find((s) => (checkout.subscriptionId && s.id === checkout.subscriptionId) || s.checkoutId === checkout.id) ?? null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const returnStatuses = new Set(["paid", "failed", "pending"]);

/**
 * Where the backend's checkout redirect (`{ReturnUrl}?checkout={id}&status=paid|failed|pending`) lands in the panel: the
 * checkout's page in the workspace that started it. Anything malformed goes to the billing page, or the workspace list.
 */
export function checkoutReturnPath(workspaceId: string | null | undefined, checkout: string | null | undefined, status: string | null | undefined): string {
  if (!workspaceId || !uuid.test(workspaceId)) return "/workspaces";
  const base = `/w/${workspaceId}/billing`;
  if (!checkout || !uuid.test(checkout)) return base;
  return `${base}/checkouts/${checkout}${status && returnStatuses.has(status) ? `?status=${status}` : ""}`;
}

/** Cookie the billing page sets before leaving for Zarinpal, so the return lands in the same workspace. */
export const checkoutCookie = "pk-checkout";
