"use client";

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { StartCheckout } from "@/lib/api/types";
import { checkoutCookie, type Cycle } from "./checkout";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

export function useCurrentPlan(ws: string) {
  return useQuery({
    queryKey: qk.billingPlan(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/subscription", { params: { path: { workspaceId: ws } } })),
  });
}

export function useUsage(ws: string) {
  return useQuery({
    queryKey: qk.billingUsage(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/usage", { params: { path: { workspaceId: ws } } })),
    refetchInterval: 5 * 60_000,
  });
}

/** Plans on sale in display order, each with what buying it would be now (BE-2.8). */
export function useBillingPlans(ws: string) {
  return useQuery({
    queryKey: qk.billingPlans(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/plans", { params: ws$(ws) })),
  });
}

/** What the seller adds to a quote: a coupon code (already applied) and whether to pay from the wallet. */
export type QuoteExtras = { couponCode: string | null; useWallet: boolean };

const quoteBody = (planId: string, cycle: Cycle, extras: QuoteExtras) => ({ planId, cycle, couponCode: extras.couponCode, useWallet: extras.useWallet });

async function fetchQuote(ws: string, planId: string, cycle: Cycle, extras: QuoteExtras) {
  return unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/checkout/quote", { params: ws$(ws), body: quoteBody(planId, cycle, extras) }));
}

/** What buying `planId` for `cycle` costs now and when it would run. Saves nothing on the backend; refetched on every open. */
export function useCheckoutQuote(ws: string, planId: string, cycle: Cycle, extras: QuoteExtras = { couponCode: null, useWallet: false }) {
  return useQuery({
    queryKey: qk.billingQuote(ws, planId, cycle, extras.couponCode, extras.useWallet),
    queryFn: () => fetchQuote(ws, planId, cycle, extras),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    placeholderData: (previous) => previous,
  });
}

/**
 * Tries a coupon on the quote before the dialog switches to it, so a refused code (expired, used up, not for this plan…)
 * is told under the field while the quote without it stays on screen. A good code's quote is put in the cache.
 */
export function useTryCoupon(ws: string, planId: string, cycle: Cycle) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ couponCode, useWallet }: { couponCode: string; useWallet: boolean }) => fetchQuote(ws, planId, cycle, { couponCode, useWallet }),
    onSuccess: (quote, { couponCode, useWallet }) => {
      qc.setQueryData(qk.billingQuote(ws, planId, cycle, quote.couponCode ?? couponCode, useWallet), quote);
    },
  });
}

/**
 * Opens the checkout and sends the browser to Zarinpal. The `pk-checkout` cookie remembers the workspace, because the
 * backend's return URL only carries the checkout id. When the coupon and the wallet cover it all there is no payment
 * page: the checkout is already paid and the panel opens it.
 */
export function useStartCheckout(ws: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ planId, cycle, extras, idempotencyKey }: { planId: string; cycle: Cycle; extras: QuoteExtras; idempotencyKey: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/checkout", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } }, body: quoteBody(planId, cycle, extras) })),
    onSuccess: (started) => openPayment(qc, router, ws, started),
  });
}

/** After a checkout opens: to Zarinpal when there is something to pay, otherwise straight to the (already paid) checkout. */
export function openPayment(qc: QueryClient, router: ReturnType<typeof useRouter>, ws: string, { checkout, paymentUrl }: StartCheckout) {
  void qc.invalidateQueries({ queryKey: qk.checkouts(ws) });
  void qc.invalidateQueries({ queryKey: qk.wallet(ws) });
  if (!paymentUrl) {
    router.push(`/w/${ws}/billing/checkouts/${checkout.id}`);
    return;
  }
  document.cookie = `${checkoutCookie}=${ws}; path=/; max-age=7200; samesite=lax`;
  window.location.assign(paymentUrl);
}

/** The prepaid wallet: balance and its latest 100 changes. */
export function useWallet(ws: string) {
  return useQuery({
    queryKey: qk.wallet(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/wallet", { params: ws$(ws) })),
  });
}

/** Pays `amount` Rial into the wallet through Zarinpal; the balance grows when Zarinpal confirms. */
export function useWalletTopUp(ws: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/wallet/top-up", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } }, body: { amount } })),
    onSuccess: (started) => openPayment(qc, router, ws, started),
  });
}

/** Checkouts and invoices, newest first (the backend keeps the last 100). */
export function useCheckouts(ws: string) {
  return useQuery({
    queryKey: qk.checkouts(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/checkouts", { params: ws$(ws) })),
  });
}

/** One checkout. While it is pending (the gateway has not confirmed yet) it is checked every 5 seconds. */
export function useCheckout(ws: string, checkoutId: string) {
  return useQuery({
    queryKey: qk.checkout(ws, checkoutId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/checkouts/{checkoutId}", { params: { path: { workspaceId: ws, checkoutId } } })),
    refetchInterval: (q) => (q.state.data?.status === "pending" && q.state.dataUpdateCount < 24 ? 5_000 : false),
  });
}

/** After a paid checkout the plan, its limits, the options and the history all change. */
export function useRefreshBilling(ws: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["billing", ws] });
}

export { newIdempotencyKey };

/** 0–1 share of a limit, or null when the meter is unlimited. */
export function shareOf(used: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined) return null;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, used / limit);
}

export type MeterState = "ok" | "near" | "full";

export function meterState(used: number, limit: number | null | undefined): MeterState {
  const share = shareOf(used, limit);
  if (share === null) return "ok";
  if (share >= 1) return "full";
  return share >= 0.8 ? "near" : "ok";
}

/** Whole days from now until `endsAt` (at least 0), for "۱۲ روز مانده". */
export function daysLeft(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000));
}
