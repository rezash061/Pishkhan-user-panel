"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

export function useChannels(ws: string) {
  return useQuery({
    queryKey: qk.channels(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/channels", { params: { path: { workspaceId: ws } } })),
    staleTime: 60_000,
  });
}

export function useChannelMedia(ws: string, channelId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.media(ws, channelId),
    enabled,
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/channels/{channelId}/media", { params: { path: { workspaceId: ws, channelId }, query: { limit: 12 } } })),
  });
}

export function useDisconnectChannel(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/channels/{channelId}", { params: { path: { workspaceId: ws, channelId } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.channels(ws) }),
  });
}
