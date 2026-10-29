"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { Conversation, ConversationStatus, Message, Page } from "@/lib/api/types";

export type InboxFilter = "all" | "mine" | "unassigned" | "handed_off" | "unread" | "closed";
export const inboxFilters: InboxFilter[] = ["all", "mine", "unassigned", "handed_off", "unread", "closed"];

const filterQuery: Record<InboxFilter, { status?: string; assignee?: string; unread?: boolean }> = {
  all: {},
  mine: { assignee: "me" },
  unassigned: { assignee: "none" },
  handed_off: { status: "handed_off" },
  unread: { unread: true },
  closed: { status: "closed" },
};

type ConversationPages = InfiniteData<Page<Conversation>, string | null>;
type MessagePages = InfiniteData<Page<OptimisticMessage>, string | null>;

/** A message as shown in the thread; `local` marks an optimistic send that the server has not confirmed yet. */
export type OptimisticMessage = Message & { local?: "sending" | "failed"; localError?: string };

function normalize(c: Conversation): Conversation {
  return { ...c, unreadCount: Number(c.unreadCount) || 0 };
}

export function useConversations(ws: string, filter: InboxFilter) {
  return useInfiniteQuery({
    queryKey: qk.conversationList(ws, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/conversations", {
          params: { path: { workspaceId: ws }, query: { ...filterQuery[filter], cursor: pageParam ?? undefined, limit: 30 } },
        }),
      );
      return { items: page.items.map((c) => normalize(c as Conversation)), nextCursor: page.nextCursor } satisfies Page<Conversation>;
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useConversation(ws: string, id: string) {
  return useQuery({
    queryKey: qk.conversation(ws, id),
    queryFn: async () =>
      normalize(unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}", { params: { path: { workspaceId: ws, conversationId: id } } })) as Conversation),
  });
}

/** Messages, newest first per page (backend keyset order); the thread reverses them for display. */
export function useMessages(ws: string, id: string) {
  return useInfiniteQuery({
    queryKey: qk.messages(ws, id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/messages", {
          params: { path: { workspaceId: ws, conversationId: id }, query: { cursor: pageParam ?? undefined, limit: 40 } },
        }),
      ) as Page<OptimisticMessage>,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useNotes(ws: string, id: string) {
  return useQuery({
    queryKey: qk.notes(ws, id),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/notes", { params: { path: { workspaceId: ws, conversationId: id } } })),
  });
}

export function useQuickReplies(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.quickReplies(ws),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/quick-replies", { params: { path: { workspaceId: ws } } })),
  });
}

/* ---------- cache helpers (used by mutations and by realtime events) ---------- */

/** Merges fields into a conversation wherever it is cached: detail query and every list. Returns whether any list had it. */
export function patchConversation(qc: QueryClient, ws: string, id: string, patch: Partial<Conversation>): boolean {
  let found = false;
  qc.setQueryData<Conversation>(qk.conversation(ws, id), (old) => (old ? { ...old, ...patch } : old));
  qc.setQueriesData<ConversationPages>({ queryKey: qk.conversationLists(ws) }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((c) => {
          if (c.id !== id) return c;
          found = true;
          return { ...c, ...patch };
        }),
      })),
    };
  });
  return found;
}

export function setConversation(qc: QueryClient, ws: string, conversation: Conversation) {
  const c = normalize(conversation);
  qc.setQueryData(qk.conversation(ws, c.id), c);
  patchConversation(qc, ws, c.id, c);
}

/** Adds a message to the newest page if it is not there yet (the hub also echoes our own sends). */
export function upsertMessage(qc: QueryClient, ws: string, conversationId: string, message: OptimisticMessage, replaceLocalId?: string) {
  qc.setQueryData<MessagePages>(qk.messages(ws, conversationId), (old) => {
    if (!old) return old;
    const pages = old.pages.map((page) => ({
      ...page,
      items: page.items.filter((m) => m.id !== replaceLocalId).map((m) => (m.id === message.id ? { ...m, ...message, local: message.local } : m)),
    }));
    const exists = pages.some((p) => p.items.some((m) => m.id === message.id));
    if (!exists && pages[0]) pages[0] = { ...pages[0], items: [message, ...pages[0].items] };
    return { ...old, pages };
  });
}

export function updateMessageStatus(qc: QueryClient, ws: string, conversationId: string, messageId: string, status: string, errorCode: string | null, upTo: boolean) {
  qc.setQueryData<MessagePages>(qk.messages(ws, conversationId), (old) => {
    if (!old) return old;
    // Pages are newest first; with upTo, the named message and every older outbound one get the status.
    let reached = false;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => {
          if (m.id === messageId) {
            reached = true;
            return { ...m, status, errorCode };
          }
          if (upTo && reached && m.direction === "outbound" && m.status !== "failed") return { ...m, status };
          return m;
        }),
      })),
    };
  });
}

/* ---------- mutations ---------- */

function useConversationMutation<TVars>(ws: string, id: string, call: (vars: TVars) => Promise<Conversation>, optimistic?: (vars: TVars) => Partial<Conversation>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: call,
    onMutate: (vars) => {
      if (optimistic) patchConversation(qc, ws, id, optimistic(vars));
    },
    onSuccess: (conversation) => setConversation(qc, ws, conversation),
    onError: () => {
      void qc.invalidateQueries({ queryKey: qk.conversation(ws, id) });
      void qc.invalidateQueries({ queryKey: qk.conversationLists(ws) });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.conversationLists(ws) }),
  });
}

export function useAssign(ws: string, id: string) {
  return useConversationMutation(
    ws,
    id,
    async (assigneeId: string | null) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/assign", {
          params: { path: { workspaceId: ws, conversationId: id } },
          body: { assigneeId },
        }),
      ) as Conversation,
    (assigneeId) => ({ assigneeId }),
  );
}

export function useChangeStatus(ws: string, id: string) {
  return useConversationMutation(
    ws,
    id,
    async (status: ConversationStatus) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/status", {
          params: { path: { workspaceId: ws, conversationId: id } },
          body: { status, reason: null },
        }),
      ) as Conversation,
    (status) => ({ status, ...(status === "handed_off" ? { aiPaused: true } : {}) }),
  );
}

export function useAiPause(ws: string, id: string) {
  return useConversationMutation(
    ws,
    id,
    async (paused: boolean) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/ai-pause", {
          params: { path: { workspaceId: ws, conversationId: id } },
          body: { paused },
        }),
      ) as Conversation,
    (paused) => ({ aiPaused: paused }),
  );
}

export function useMarkRead(ws: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response } = await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/read", {
        params: { path: { workspaceId: ws, conversationId: id } },
      });
      return response.ok;
    },
    onMutate: () => patchConversation(qc, ws, id, { unreadCount: 0 }),
  });
}

export function useAddNote(ws: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/notes", {
          params: { path: { workspaceId: ws, conversationId: id } },
          body: { text },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notes(ws, id) }),
  });
}

/**
 * Sends a reply optimistically: the bubble appears at once with "sending", becomes the server's message on 202,
 * or shows "failed" with a retry. One Idempotency-Key per attempt chain, so a retry after a timeout cannot double-send.
 */
export function useSendMessage(ws: string, id: string, myUserId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { text: string; localId: string; idempotencyKey: string }) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/conversations/{conversationId}/messages", {
          params: { path: { workspaceId: ws, conversationId: id }, header: { "Idempotency-Key": vars.idempotencyKey } },
          body: { text: vars.text, quickReplies: null, buttons: null },
        }),
      ),
    onMutate: (vars) => {
      const now = new Date().toISOString();
      upsertMessage(qc, ws, id, {
        id: vars.localId,
        createdAt: now,
        direction: "outbound",
        kind: "text",
        text: vars.text,
        status: "queued",
        errorCode: null,
        handledBy: "human",
        sentBy: myUserId,
        tag: null,
        sentAt: null,
        readAt: null,
        local: "sending",
      });
    },
    onSuccess: (message, vars) => {
      upsertMessage(qc, ws, id, message, vars.localId);
      patchConversation(qc, ws, id, { lastMessagePreview: vars.text });
    },
    onError: (error, vars) => {
      qc.setQueryData<MessagePages>(qk.messages(ws, id), (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.map((m) => (m.id === vars.localId ? { ...m, local: "failed" as const, localError: error instanceof Error ? error.message : undefined } : m)),
              })),
            }
          : old,
      );
    },
  });
}

export function newLocalMessage() {
  return { localId: `local-${crypto.randomUUID()}`, idempotencyKey: newIdempotencyKey() };
}
