"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

export const followUpStatuses = ["pending", "sent", "cancelled", "skipped"] as const;
export type FollowUpStatus = (typeof followUpStatuses)[number];

/** Reasons a follow-up was cancelled or skipped (backend `FollowUpReasons`). */
export const followUpReasons = ["replied", "purchased", "owner", "replaced", "handed_off", "window_closed", "conversation_gone"] as const;

/** Follow-ups by status (pending soonest first, the rest newest first), optionally for one conversation (BE-1.8). */
export function useFollowUps(ws: string, filter: { status?: FollowUpStatus; conversationId?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: qk.followUpList(ws, filter),
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/automation/followups", {
          params: { path: { workspaceId: ws }, query: { Status: filter.status, ConversationId: filter.conversationId, Limit: filter.limit ?? 100 } },
        }),
      ),
    refetchInterval: filter.status === "pending" ? 60_000 : false,
  });
}

export function useCancelFollowUp(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (followUpId: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/followups/{followUpId}/cancel", { params: { path: { workspaceId: ws, followUpId } } })),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.followUps(ws) }),
  });
}
