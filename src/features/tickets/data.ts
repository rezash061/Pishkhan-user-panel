"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { OpenTicketRequest, SupportTicket, SupportTicketDetail } from "@/lib/api/types";

/** Backend `TicketCategories` and `TicketStatuses` (UP-1.18). */
export const ticketCategories = ["billing", "technical", "instagram", "ai", "other"] as const;
export const ticketStatuses = ["open", "answered", "closed"] as const;
/** Backend limits: subject 3–150 characters, a message up to 4,000, at most 10 tickets not closed per workspace. */
export const ticketLimits = { subjectMin: 3, subject: 150, body: 4000 } as const;
export const TICKETS_PAGE_SIZE = 20;

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });
const one = (ws: string, ticketId: string) => ({ path: { workspaceId: ws, ticketId } });

export function useTickets(ws: string, status: string, page: number) {
  return useQuery({
    queryKey: qk.ticketList(ws, { status, page }),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/support/tickets", {
          params: { path: { workspaceId: ws }, query: { status: status || undefined, page, pageSize: TICKETS_PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useTicket(ws: string, ticketId: string) {
  return useQuery({
    queryKey: qk.ticket(ws, ticketId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/support/tickets/{ticketId}", { params: one(ws, ticketId) })),
    // Replies from Pishkhan arrive as a notification; a light refresh keeps an open thread current too.
    refetchInterval: 60_000,
  });
}

function useTicketChange<T>(ws: string, fn: (vars: T) => Promise<SupportTicketDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(qk.ticket(ws, detail.ticket.id), detail);
      void qc.invalidateQueries({ queryKey: qk.tickets(ws), predicate: (q) => q.queryKey[2] === "list" });
    },
  });
}

export function useOpenTicket(ws: string) {
  return useTicketChange(ws, async (body: OpenTicketRequest) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/support/tickets", { params: ws$(ws), body })));
}

export function useReplyTicket(ws: string, ticketId: string) {
  return useTicketChange(ws, async (body: string) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/support/tickets/{ticketId}/messages", { params: one(ws, ticketId), body: { body } })),
  );
}

export function useCloseTicket(ws: string, ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/support/tickets/{ticketId}/close", { params: one(ws, ticketId) })),
    onSuccess: (ticket: SupportTicket) => {
      qc.setQueryData<SupportTicketDetail>(qk.ticket(ws, ticketId), (old) => (old ? { ...old, ticket } : old));
      void qc.invalidateQueries({ queryKey: qk.tickets(ws), predicate: (q) => q.queryKey[2] === "list" });
    },
  });
}

/** Platform notices for the banner (AD-2.6); refreshed every few minutes so a new outage notice shows without a reload. */
export function useAnnouncements(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.announcements(ws),
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/announcements", { params: ws$(ws) })),
  });
}
