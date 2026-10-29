"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { WorkspaceRole } from "@/lib/api/types";

export function useMembers(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.members(ws),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/members", { params: { path: { workspaceId: ws } } })),
  });
}

export function useInvite(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { phone: string; role: WorkspaceRole }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/invitations", { params: { path: { workspaceId: ws } }, body: vars })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(ws) }),
  });
}

/** Invitations not yet accepted or expired (phones come masked). Needs `workspace.members.manage`. */
export function usePendingInvitations(ws: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.invitations(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/invitations", { params: { path: { workspaceId: ws } } })),
  });
}

export function useRevokeInvitation(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/invitations/{invitationId}", { params: { path: { workspaceId: ws, invitationId } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(ws) }),
  });
}

export function useChangeRole(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; role: WorkspaceRole }) =>
      unwrap(await api.PATCH("/api/v1/workspaces/{workspaceId}/members/{userId}", { params: { path: { workspaceId: ws, userId: vars.userId } }, body: { role: vars.role } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(ws) }),
  });
}

export function useRemoveMember(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/members/{userId}", { params: { path: { workspaceId: ws, userId } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(ws) }),
  });
}
