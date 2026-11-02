"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { MerchantAccountRequest, PaymentLink } from "@/lib/api/types";

/** Zarinpal merchant IDs are 36 characters (a UUID). */
export const merchantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

export function useMerchantAccount(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.merchantAccount(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/payments/merchant-account", { params: ws$(ws) })),
  });
}

export function useSaveMerchantAccount(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: MerchantAccountRequest) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/payments/merchant-account", { params: ws$(ws), body })),
    onSuccess: (account) => qc.setQueryData(qk.merchantAccount(ws), account),
  });
}

export function useDisconnectMerchant(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/payments/merchant-account", { params: ws$(ws) });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.merchantAccount(ws) }),
  });
}

/**
 * An order's payment links, newest first. While one is active the list is polled, and when a link turns paid the
 * order is refetched (the backend moves it to `paid` on its own).
 */
export function usePaymentLinks(ws: string, orderId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.paymentLinks(ws, orderId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/{orderId}/payment-links", { params: { path: { workspaceId: ws, orderId } } })),
    refetchInterval: (q) => (q.state.data?.some((l) => l.status === "active") ? 15_000 : false),
  });
  const paid = query.data?.filter((l) => l.status === "paid").length ?? 0;
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current !== null && paid > seen.current) void qc.invalidateQueries({ queryKey: qk.orders(ws) });
    seen.current = paid;
  }, [paid, qc, ws]);
  return query;
}

function useLinkChange<T>(ws: string, orderId: string, fn: (vars: T) => Promise<PaymentLink>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Creating a link can move the order to awaiting_payment; refresh the order, its timeline and the lists.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.paymentLinks(ws, orderId) });
      void qc.invalidateQueries({ queryKey: qk.orders(ws) });
    },
  });
}

export function useCreatePaymentLink(ws: string, orderId: string) {
  return useLinkChange(ws, orderId, async (idempotencyKey: string) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders/{orderId}/payment-links", { params: { path: { workspaceId: ws, orderId }, header: { "Idempotency-Key": idempotencyKey } } })),
  );
}

export function useCancelPaymentLink(ws: string, orderId: string) {
  return useLinkChange(ws, orderId, async (linkId: string) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/payment-links/{linkId}/cancel", { params: { path: { workspaceId: ws, linkId } } })),
  );
}

export { newIdempotencyKey };
