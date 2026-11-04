"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { FeedImportDetail, FeedItem, FeedItemUpdate } from "@/lib/api/types";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });
const imp$ = (ws: string, importId: string) => ({ path: { workspaceId: ws, importId } });
const item$ = (ws: string, importId: string, itemId: string) => ({ path: { workspaceId: ws, importId, itemId } });

/** The last 20 feed imports (BE-2.5). Polled while one is still reading posts. */
export function useFeedImports(ws: string) {
  return useQuery({
    queryKey: qk.feedImports(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports", { params: ws$(ws) })),
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === "running") ? 4_000 : false),
  });
}

/** One import with its suggestions, pending first; polled every 3 seconds while `running`. */
export function useFeedImport(ws: string, importId: string) {
  return useQuery({
    queryKey: qk.feedImport(ws, importId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports/{importId}", { params: imp$(ws, importId) })),
    refetchInterval: (q) => (q.state.data?.import.status === "running" ? 3_000 : false),
  });
}

export function useStartFeedImport(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { channelAccountId: string; maxPosts: number }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports", { params: ws$(ws), body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedImports(ws) }),
  });
}

/** Replaces items in the cached import, and its pending count. */
function patchItems(detail: FeedImportDetail | undefined, changed: FeedItem[]): FeedImportDetail | undefined {
  if (!detail) return detail;
  const byId = new Map(changed.map((i) => [i.id, i]));
  const items = detail.items.map((i) => byId.get(i.id) ?? i);
  return { ...detail, items, import: { ...detail.import, pending: items.filter((i) => i.status === "pending").length } };
}

function useItemsChanged(ws: string, importId: string) {
  const qc = useQueryClient();
  return (changed: FeedItem[], accepted = false) => {
    qc.setQueryData<FeedImportDetail>(qk.feedImport(ws, importId), (d) => patchItems(d, changed));
    void qc.invalidateQueries({ queryKey: qk.feedImports(ws), exact: true });
    if (accepted) {
      // New products and FAQs: refresh the catalog, the knowledge list and the score.
      void qc.invalidateQueries({ queryKey: qk.productLists(ws) });
      void qc.invalidateQueries({ queryKey: qk.knowledge(ws), predicate: (q) => q.queryKey[2] !== "feed-imports" });
    }
  };
}

export function useUpdateFeedItem(ws: string, importId: string) {
  const changed = useItemsChanged(ws, importId);
  return useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: FeedItemUpdate }) =>
      unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports/{importId}/items/{itemId}", { params: item$(ws, importId, itemId), body })),
    onSuccess: (item) => changed([item]),
  });
}

export function useAcceptFeedItem(ws: string, importId: string) {
  const changed = useItemsChanged(ws, importId);
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports/{importId}/items/{itemId}/accept", { params: item$(ws, importId, itemId), body: { activate: true } })),
    onSuccess: (item) => changed([item], true),
  });
}

export function useRejectFeedItem(ws: string, importId: string) {
  const changed = useItemsChanged(ws, importId);
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports/{importId}/items/{itemId}/reject", { params: item$(ws, importId, itemId) })),
    onSuccess: (item) => changed([item]),
  });
}

/** Accepts many at once (up to 100); returns what was accepted and, per item id, why the others were not. */
export function useAcceptFeedItems(ws: string, importId: string) {
  const changed = useItemsChanged(ws, importId);
  return useMutation({
    mutationFn: async (itemIds: string[]) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/feed-imports/{importId}/accept", { params: imp$(ws, importId), body: { itemIds, activate: true } })),
    onSuccess: (r) => changed(r.accepted, true),
  });
}
