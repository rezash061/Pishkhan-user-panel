"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { KnowledgeSource } from "@/lib/api/types";

export const sourceKinds = ["faq", "text", "product"] as const;
export type SourceKind = (typeof sourceKinds)[number];
export const sourceStatuses = ["pending", "indexed", "failed"] as const;

/** Backend limits (Knowledge module): titles 200, questions 300, FAQ answers 2,000, text bodies 50,000 characters. */
export const limits = { title: 200, question: 300, answer: 2000, body: 50000, query: 500 } as const;

export interface SourceFilter {
  kind?: string;
  q?: string;
  status?: string;
}

/** Indexing is asynchronous: a source is still being prepared until its indexed revision catches up. */
export const isIndexing = (s: KnowledgeSource) => s.status === "pending" || (s.status !== "failed" && s.indexedRevision !== s.revision);

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });
const one = (ws: string, id: string) => ({ path: { workspaceId: ws, sourceId: id } });

export function useSources(ws: string, filter: SourceFilter) {
  return useInfiniteQuery({
    queryKey: qk.knowledgeList(ws, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/knowledge/sources", {
          params: {
            path: { workspaceId: ws },
            query: {
              limit: 30,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(filter.kind ? { kind: filter.kind } : {}),
              ...(filter.q ? { q: filter.q } : {}),
              ...(filter.status ? { status: filter.status } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    placeholderData: keepPreviousData,
    // Poll while something on screen is still being indexed.
    refetchInterval: (q) => (q.state.data?.pages.some((p) => p.items.some(isIndexing)) ? 3000 : false),
  });
}

function useKnowledgeMutation<T, R>(ws: string, fn: (vars: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: qk.knowledge(ws) }) });
}

export type SourceInput = { kind: "faq"; question: string; answer: string } | { kind: "text"; title: string; body: string };

export function useSaveSource(ws: string) {
  return useKnowledgeMutation(ws, async ({ id, input }: { id: string | null; input: SourceInput }) => {
    const fields =
      input.kind === "faq"
        ? { title: null, question: input.question, answer: input.answer, body: null }
        : { title: input.title, question: null, answer: null, body: input.body };
    return id
      ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/knowledge/sources/{sourceId}", { params: one(ws, id), body: { ...fields, enabled: null } }))
      : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/sources", { params: ws$(ws), body: { kind: input.kind, ...fields, enabled: true } }));
  });
}

export function useToggleSource(ws: string) {
  return useKnowledgeMutation(ws, async ({ id, enabled }: { id: string; enabled: boolean }) =>
    unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/knowledge/sources/{sourceId}", { params: one(ws, id), body: { title: null, question: null, answer: null, body: null, enabled } })),
  );
}

export function useReindexSource(ws: string) {
  return useKnowledgeMutation(ws, async (id: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/sources/{sourceId}/reindex", { params: one(ws, id) })));
}

export function useDeleteSource(ws: string) {
  return useKnowledgeMutation(ws, async (id: string) => unwrap(await api.DELETE("/api/v1/workspaces/{workspaceId}/knowledge/sources/{sourceId}", { params: one(ws, id) })));
}

export function useKnowledgeSearch(ws: string) {
  return useMutation({
    mutationFn: async (query: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/search", { params: ws$(ws), body: { query, limit: 5 } })),
  });
}
