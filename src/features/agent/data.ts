"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { AgentProfile } from "@/lib/api/types";

export const tones = ["friendly", "formal", "playful"] as const;
export const outcomes = ["sent", "handed_off", "failed"] as const;

/** Backend limits (Agent module, BE-1.4 part 2). */
export const agentLimits = { name: 60, brandVoice: 1000, handoffMessage: 1000, phrases: 50, phrase: 100, minThreshold: 0.3, maxThreshold: 0.95 } as const;

const path = (ws: string) => ({ path: { workspaceId: ws } });

export function useAgentProfile(ws: string) {
  return useQuery({
    queryKey: qk.agentProfile(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/agent/profile", { params: path(ws) })),
  });
}

export function useSaveAgentProfile(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AgentProfile) => unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/agent/profile", { params: path(ws), body })),
    onSuccess: (data) => qc.setQueryData(qk.agentProfile(ws), data),
  });
}

export interface TraceFilter {
  conversationId?: string;
  outcome?: string;
}

export function useTraces(ws: string, filter: TraceFilter) {
  return useInfiniteQuery({
    queryKey: qk.agentTraces(ws, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/agent/traces", {
          params: {
            path: { workspaceId: ws },
            query: {
              limit: 30,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(filter.conversationId ? { conversationId: filter.conversationId } : {}),
              ...(filter.outcome ? { outcome: filter.outcome } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    placeholderData: keepPreviousData,
  });
}

export function useTrace(ws: string, id: string) {
  return useQuery({
    queryKey: qk.agentTrace(ws, id),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/agent/traces/{traceId}", { params: { path: { workspaceId: ws, traceId: id } } })),
  });
}
