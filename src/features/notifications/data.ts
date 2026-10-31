"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { NotificationPreference } from "@/lib/api/types";

/** There is no realtime event for notifications yet, so the badge polls (and refetches on handoff and channel events). */
const POLL_MS = 60_000;

export function useUnreadNotifications(ws: string) {
  return useQuery({
    queryKey: qk.notificationCount(ws),
    refetchInterval: POLL_MS,
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/notifications", { params: { path: { workspaceId: ws }, query: { unread: true, limit: 1 } } })).unreadCount,
  });
}

export function useNotifications(ws: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.notifications(ws),
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/notifications", { params: { path: { workspaceId: ws }, query: { cursor: pageParam ?? undefined, limit: 20 } } })),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useMarkNotificationRead(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | "all") => {
      const { response, error } =
        id === "all"
          ? await api.POST("/api/v1/workspaces/{workspaceId}/notifications/read-all", { params: { path: { workspaceId: ws } } })
          : await api.POST("/api/v1/workspaces/{workspaceId}/notifications/{notificationId}/read", { params: { path: { workspaceId: ws, notificationId: id } } });
      if (!response.ok) unwrap({ error, response });
    },
    // Both the list and the badge count live under the notifications key.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications(ws) }),
  });
}

export function useNotificationPreferences(ws: string) {
  return useQuery({
    queryKey: qk.notificationPreferences(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/notification-preferences", { params: { path: { workspaceId: ws } } })),
  });
}

export function useSaveNotificationPreferences(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: NotificationPreference[]) =>
      unwrap(
        await api.PUT("/api/v1/workspaces/{workspaceId}/notification-preferences", {
          params: { path: { workspaceId: ws } },
          body: { items: items.map(({ kind, inApp, push, sms }) => ({ kind, inApp, push, sms })) },
        }),
      ),
    onSuccess: (data) => qc.setQueryData(qk.notificationPreferences(ws), data),
  });
}

/**
 * Notification links are panel paths relative to the workspace (`/inbox/{id}`). Channel problems point at the
 * channels page, which lives at `/channels` here.
 */
export function notificationHref(ws: string, link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  return `/w/${ws}${link.replace(/^\/settings\/channels\b/, "/channels")}`;
}
