"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { BankAccountRequest, Receipt, ReceiptSettingsRequest } from "@/lib/api/types";

/** Backend `ReceiptStatuses`. */
export const receiptStatuses = ["needs_review", "auto_approved", "approved", "rejected", "processing", "scanning"] as const;
export type ReceiptStatus = (typeof receiptStatuses)[number];

/** Backend `ReceiptCheckKeys`, in the order the checks are shown. */
export const receiptCheckKeys = ["extraction", "order", "amount", "destination", "time_window", "format", "duplicate"] as const;

/** Backend limits: 10 bank accounts, reject reasons up to 300 characters, threshold 0.8–1, tolerance up to 100,000 Toman, window 1–720 hours. */
export const receiptLimits = { accounts: 10, reason: 300, minThreshold: 0.8, maxToleranceRial: 1_000_000, maxWindowHours: 720 } as const;

/** Still being scanned or read: the list polls while one of these is shown. */
export const isWorking = (r: Pick<Receipt, "status">) => r.status === "scanning" || r.status === "processing";

/** A duplicate rejected automatically (no member decided it): the seller can still approve it. */
export const isAutoDuplicate = (r: Pick<Receipt, "status" | "rejectReason" | "decidedBy">) =>
  r.status === "rejected" && r.rejectReason === "duplicate" && !r.decidedBy;

export const canDecide = (r: Pick<Receipt, "status" | "rejectReason" | "decidedBy">) => r.status === "needs_review" || isAutoDuplicate(r);

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

export function useBankAccounts(ws: string) {
  return useQuery({
    queryKey: qk.bankAccounts(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/payments/bank-accounts", { params: ws$(ws) })),
  });
}

export function useSaveBankAccount(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: BankAccountRequest }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/payments/bank-accounts/{accountId}", { params: { path: { workspaceId: ws, accountId: id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/payments/bank-accounts", { params: ws$(ws), body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bankAccounts(ws) }),
  });
}

export function useDeleteBankAccount(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/payments/bank-accounts/{accountId}", { params: { path: { workspaceId: ws, accountId: id } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bankAccounts(ws) }),
  });
}

export function useReceiptSettings(ws: string) {
  return useQuery({
    queryKey: qk.receiptSettings(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/payments/receipt-settings", { params: ws$(ws) })),
  });
}

export function useSaveReceiptSettings(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReceiptSettingsRequest) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/payments/receipt-settings", { params: ws$(ws), body })),
    onSuccess: (settings) => qc.setQueryData(qk.receiptSettings(ws), settings),
  });
}

export interface ReceiptFilter {
  status?: string;
  orderId?: string;
}

/** Receipts, newest first; polls while any shown receipt is still being scanned or read. */
export function useReceipts(ws: string, filter: ReceiptFilter, { enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: qk.receiptList(ws, filter),
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/receipts", {
          params: {
            path: { workspaceId: ws },
            query: { ...(filter.status ? { status: filter.status } : {}), ...(filter.orderId ? { orderId: filter.orderId } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    refetchInterval: (q) => (q.state.data?.pages.some((p) => p.items.some(isWorking)) ? 4_000 : false),
  });
}

/** One receipt with a signed image URL (valid 10 minutes, so it is refetched after 8). */
export function useReceipt(ws: string, id: string | null) {
  return useQuery({
    queryKey: qk.receipt(ws, id ?? ""),
    enabled: Boolean(id),
    staleTime: 8 * 60_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/receipts/{receiptId}", { params: { path: { workspaceId: ws, receiptId: id! } } })),
    refetchInterval: (q) => (q.state.data && isWorking(q.state.data) ? 4_000 : false),
  });
}

function useReceiptChange<T>(ws: string, fn: (vars: T) => Promise<Receipt>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Approving pays the order: refresh the receipts and the orders.
    onSuccess: (receipt) => {
      qc.setQueryData(qk.receipt(ws, receipt.id), (old: Receipt | undefined) => ({ ...receipt, imageUrl: old?.imageUrl ?? receipt.imageUrl }));
      void qc.invalidateQueries({ queryKey: qk.receipts(ws) });
      void qc.invalidateQueries({ queryKey: qk.orders(ws) });
    },
  });
}

export function useApproveReceipt(ws: string) {
  return useReceiptChange(ws, async ({ id, orderId }: { id: string; orderId?: string | null }) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/receipts/{receiptId}/approve", { params: { path: { workspaceId: ws, receiptId: id } }, body: { orderId: orderId ?? null } })),
  );
}

export function useRejectReceipt(ws: string) {
  return useReceiptChange(ws, async ({ id, reason }: { id: string; reason: string }) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/receipts/{receiptId}/reject", { params: { path: { workspaceId: ws, receiptId: id } }, body: { reason } })),
  );
}

/** Submits a receipt from an uploaded (clean) file or a customer's image message. */
export function useSubmitReceipt(ws: string) {
  return useReceiptChange(ws, async (body: { fileId?: string | null; messageId?: string | null; orderId?: string | null }) =>
    unwrap(
      await api.POST("/api/v1/workspaces/{workspaceId}/receipts", {
        params: { path: { workspaceId: ws }, header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { fileId: body.fileId ?? null, messageId: body.messageId ?? null, orderId: body.orderId ?? null },
      }),
    ),
  );
}
