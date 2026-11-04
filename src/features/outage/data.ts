"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

/** Instagram's platform status for the banner (BE-2.7). Polled every minute; a `channel_outage` notification refreshes it. */
export function useOutageStatus(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.outageStatus(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/channels/outage", { params: ws$(ws) })),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/** Who a «move my customers» SMS would reach, whether sending is allowed now, and when the next one may go. */
export function useCampaignAudience(ws: string) {
  return useQuery({
    queryKey: qk.outageAudience(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/outage/audience", { params: ws$(ws) })),
    refetchInterval: 60_000,
  });
}

/** Campaigns, newest first; polled every 3 seconds while one is still sending. */
export function useCampaigns(ws: string) {
  return useQuery({
    queryKey: qk.outageCampaigns(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/outage/campaigns", { params: ws$(ws) })),
    refetchInterval: (q) => (q.state.data?.some((c) => c.status === "sending") ? 3_000 : false),
  });
}

export function useStartCampaign(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, idempotencyKey }: { text: string; idempotencyKey: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/outage/campaigns", { params: { ...ws$(ws), header: { "Idempotency-Key": idempotencyKey } }, body: { text: text.trim() } })),
    // Success and the cooldown and not-down refusals all change the audience's nextAllowedAt or outage.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.outageCampaigns(ws) });
      void qc.invalidateQueries({ queryKey: qk.outageAudience(ws) });
    },
  });
}

export { newIdempotencyKey };
