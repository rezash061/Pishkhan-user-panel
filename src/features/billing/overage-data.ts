"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import { useRouter } from "next/navigation";
import { openPayment } from "./data";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

/** Overage this period (BE-2.8): price, cap, conversations beyond the plan, what is owed, and whether the AI is blocked. */
export function useOverage(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.overage(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/overage", { params: ws$(ws) })),
    refetchInterval: 5 * 60_000,
  });
}

export function useUpdateOverage(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { enabled: boolean; cap: number | null }) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/billing/overage", { params: ws$(ws), body })),
    onSuccess: (o) => qc.setQueryData(qk.overage(ws), o),
  });
}

/** Charges of closed periods, newest first. */
export function useOverageCharges(ws: string) {
  return useQuery({
    queryKey: qk.overageCharges(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/overage/charges", { params: ws$(ws) })),
  });
}

/** Pays every due charge through Zarinpal; returns like a plan checkout (`/billing?checkout=`). */
export function useStartOverageCheckout(ws: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/billing/overage/checkout", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } } })),
    onSuccess: (started) => openPayment(qc, router, ws, started),
  });
}

export { newIdempotencyKey };
