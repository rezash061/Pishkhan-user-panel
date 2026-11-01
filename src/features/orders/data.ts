"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { Order, OrderRequest } from "@/lib/api/types";

/** Backend `OrderStatuses`, in the order an order normally moves through them. */
export const orderStatuses = ["draft", "awaiting_payment", "paid", "preparing", "shipped", "delivered", "completed", "cancelled", "refunded", "returned"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

/** The list's tabs: each is one or more statuses (the `status` filter is repeatable). */
export const orderTabs = {
  all: [],
  draft: ["draft"],
  awaiting_payment: ["awaiting_payment"],
  to_ship: ["paid", "preparing"],
  shipped: ["shipped"],
  done: ["delivered", "completed"],
  closed: ["cancelled", "refunded", "returned"],
} as const satisfies Record<string, readonly OrderStatus[]>;
export type OrderTab = keyof typeof orderTabs;

/** Backend limits (`Order`): 50 lines, quantity 1–1,000, titles 200, names 100, notes 2,000, address lines 500 characters. */
export const orderLimits = { items: 50, quantity: 1000, name: 100, note: 2000, title: 200, line: 500 } as const;

export interface OrderFilter {
  statuses?: readonly string[];
  contactId?: string;
  conversationId?: string;
  number?: number;
  phone?: string;
}

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });
const one = (ws: string, orderId: string) => ({ path: { workspaceId: ws, orderId } });

export function useOrders(ws: string, filter: OrderFilter, { enabled = true, limit = 30 }: { enabled?: boolean; limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: qk.orderList(ws, { ...filter, limit }),
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/orders", {
          params: {
            path: { workspaceId: ws },
            query: {
              limit,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(filter.statuses?.length ? { status: [...filter.statuses] } : {}),
              ...(filter.contactId ? { contactId: filter.contactId } : {}),
              ...(filter.conversationId ? { conversationId: filter.conversationId } : {}),
              ...(filter.number ? { number: filter.number } : {}),
              ...(filter.phone ? { phone: filter.phone } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    placeholderData: keepPreviousData,
  });
}

export function useOrder(ws: string, orderId: string) {
  return useQuery({ queryKey: qk.order(ws, orderId), queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/{orderId}", { params: one(ws, orderId) })) });
}

export function useOrderTimeline(ws: string, orderId: string) {
  return useQuery({ queryKey: qk.orderTimeline(ws, orderId), queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/{orderId}/timeline", { params: one(ws, orderId) })) });
}

export function useInvoice(ws: string, orderId: string) {
  return useQuery({ queryKey: qk.orderInvoice(ws, orderId), queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/{orderId}/invoice", { params: one(ws, orderId) })) });
}

/** The 31 provinces with their larger cities; fixed data, fetched once. */
export function useProvinces(ws: string) {
  return useQuery({ queryKey: qk.provinces, staleTime: Infinity, queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/orders/provinces", { params: ws$(ws) })) });
}

export function useParseAddress(ws: string) {
  return useMutation({ mutationFn: async (text: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders/parse-address", { params: ws$(ws), body: { text } })) });
}

/** After a change, the order itself is replaced in the cache and every list and timeline is refetched. */
function useOrderChange<T>(ws: string, fn: (vars: T) => Promise<Order>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(qk.order(ws, order.id), order);
      void qc.invalidateQueries({ queryKey: qk.orders(ws), predicate: (q) => q.queryKey[3] !== order.id || q.queryKey.length > 4 });
    },
  });
}

/** One Idempotency-Key per open editor, so a retried save cannot create the order twice. */
export function useCreateOrder(ws: string, idempotencyKey: string) {
  return useOrderChange(ws, async (body: OrderRequest) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } }, body })),
  );
}

export function useUpdateOrder(ws: string, orderId: string) {
  return useOrderChange(ws, async (body: OrderRequest) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/orders/{orderId}", { params: one(ws, orderId), body })));
}

export function useMoveOrder(ws: string, orderId: string) {
  return useOrderChange(ws, async ({ status, note }: { status: string; note: string | null }) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders/{orderId}/status", { params: one(ws, orderId), body: { status, note } })),
  );
}

export function useAddOrderNote(ws: string, orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/orders/{orderId}/notes", { params: one(ws, orderId), body: { note } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orderTimeline(ws, orderId) }),
  });
}

export { newIdempotencyKey };

/** «۱۰۲۴» style order number for headings and links. */
export const orderNumber = (n: number) => `#${n}`;
