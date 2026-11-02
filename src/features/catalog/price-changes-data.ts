"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { PriceChangeBatch, PriceChangeRequest } from "@/lib/api/types";

export { newIdempotencyKey };
export * from "./price-rule";

const base = (ws: string) => ({ params: { path: { workspaceId: ws } } });

export function usePreviewPriceChange(ws: string) {
  return useMutation({
    mutationFn: async (body: PriceChangeRequest) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/price-changes/preview", { ...base(ws), body })),
  });
}

/** Invalidates everything a price change (or its undo) touches: product lists, single products and the history. */
function useRefreshCatalog(ws: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
    void qc.invalidateQueries({ queryKey: ["product", ws] });
    void qc.invalidateQueries({ queryKey: qk.priceChanges(ws) });
  };
}

export function useApplyPriceChange(ws: string) {
  const refresh = useRefreshCatalog(ws);
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: PriceChangeRequest; idempotencyKey: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/price-changes", { params: { path: { workspaceId: ws }, header: { "Idempotency-Key": idempotencyKey } }, body })),
    onSuccess: refresh,
  });
}

export function usePriceChanges(ws: string) {
  return useQuery({
    queryKey: qk.priceChanges(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/price-changes", base(ws))),
  });
}

export function usePriceChange(ws: string, batchId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.priceChange(ws, batchId),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/price-changes/{batchId}", { params: { path: { workspaceId: ws, batchId } } })),
  });
}

export function useUndoPriceChange(ws: string) {
  const qc = useQueryClient();
  const refresh = useRefreshCatalog(ws);
  return useMutation({
    mutationFn: async (batchId: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/catalog/price-changes/{batchId}/undo", { params: { path: { workspaceId: ws, batchId } } })),
    onSuccess: (batch: PriceChangeBatch) => {
      qc.setQueryData(qk.priceChange(ws, batch.id), batch);
      refresh();
    },
  });
}
