"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
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

/** What buying `planId` for `cycle` costs now and when it would run. Saves nothing on the backend; refetched on every open. */
export function useCheckoutQuote(ws: string, planId: string, cycle: Cycle) {
  return useQuery({
    queryKey: qk.billingQuote(ws, planId, cycle),
    queryFn: async () => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/checkout/quote", { params: ws$(ws), body: { planId, cycle } })),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/**
 * Opens the payment at Zarinpal and sends the browser there. The `pk-checkout` cookie remembers the workspace, because
 * the backend's return URL only carries the checkout id.
 */
export function useStartCheckout(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, cycle, idempotencyKey }: { planId: string; cycle: Cycle; idempotencyKey: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/checkout", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } }, body: { planId, cycle } })),
    onSuccess: ({ paymentUrl }) => {
      void qc.invalidateQueries({ queryKey: qk.checkouts(ws) });
      document.cookie = `${checkoutCookie}=${ws}; path=/; max-age=7200; samesite=lax`;
      window.location.assign(paymentUrl);
    },
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
