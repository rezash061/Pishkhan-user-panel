"use client";

import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authPost } from "@/lib/api/client";

/** Event names on /hubs/inbox (overview section 6; backend InboxEvents). */
export const HubEvents = {
  conversationUpdated: "conversation.updated",
  messageCreated: "message.created",
  messageStatus: "message.status",
  handoffRequested: "handoff.requested",
  channelStatus: "channel.status",
} as const;

export type HubStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface HubContextValue {
  connection: HubConnection | null;
  status: HubStatus;
}

const HubContext = createContext<HubContextValue>({ connection: null, status: "disconnected" });

const hubUrl = process.env.NEXT_PUBLIC_HUB_URL || "/hubs/inbox";

let cachedToken: { token: string; expiresAt: number } | null = null;

/** 5-minute hub token from the BFF, reused until 30 s before it expires. */
async function realtimeToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) return cachedToken.token;
  const result = await authPost<{ token: string; expiresAt: string }>("realtime-token");
  cachedToken = { token: result.token, expiresAt: new Date(result.expiresAt).getTime() };
  return result.token;
}

/** Backoff for reconnects: quick first tries, then every 30 s for as long as the page is open. */
const retryDelay = (attempt: number) => [0, 2_000, 5_000, 10_000, 20_000][attempt] ?? 30_000;

/**
 * One SignalR connection per open workspace (plan UP-0.5). Joins the workspace group, rejoins after reconnects and
 * refetches what may have been missed while offline, because the server's pushes are best effort.
 */
export function HubProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<HubContextValue>({ connection: null, status: "connecting" });
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: realtimeToken })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => retryDelay(ctx.previousRetryCount) })
      .configureLogging(process.env.NODE_ENV === "production" ? LogLevel.None : LogLevel.Warning)
      .build();

    const join = () => connection.invoke("JoinWorkspace", workspaceId);
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const start = async (attempt = 0): Promise<void> => {
      if (stopped.current) return;
      try {
        setState({ connection, status: "connecting" });
        await connection.start();
        await join();
        setState({ connection, status: "connected" });
        if (attempt > 0) await queryClient.invalidateQueries();
      } catch {
        if (stopped.current) return;
        setState({ connection, status: "disconnected" });
        retryTimer = setTimeout(() => void start(attempt + 1), retryDelay(attempt));
      }
    };

    connection.onreconnecting(() => setState({ connection, status: "reconnecting" }));
    connection.onreconnected(async () => {
      await join().catch(() => undefined);
      setState({ connection, status: "connected" });
      // Pushes sent while we were away are lost; refetch whatever is on screen.
      await queryClient.invalidateQueries();
    });
    connection.onclose(() => {
      if (stopped.current) return;
      setState({ connection, status: "disconnected" });
      retryTimer = setTimeout(() => void start(1), 5_000);
    });

    void start();
    const onOnline = () => {
      if (connection.state === HubConnectionState.Disconnected) void start(1);
    };
    window.addEventListener("online", onOnline);

    return () => {
      stopped.current = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
      void connection.stop();
    };
  }, [workspaceId, queryClient]);

  return <HubContext.Provider value={state}>{children}</HubContext.Provider>;
}

export function useHubStatus(): HubStatus {
  return useContext(HubContext).status;
}

/** Subscribes to a hub event for the lifetime of the component. The handler may change between renders. */
export function useHubEvent<T>(event: string, handler: (payload: T) => void) {
  const { connection } = useContext(HubContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!connection) return;
    const listener = (payload: T) => latest.current(payload);
    connection.on(event, listener);
    return () => connection.off(event, listener);
  }, [connection, event]);
}

/** Joins the conversation group while a thread is open, and again after every reconnect. */
export function useJoinConversation(workspaceId: string, conversationId: string) {
  const { connection, status } = useContext(HubContext);
  useEffect(() => {
    if (!connection || status !== "connected") return;
    void connection.invoke("JoinConversation", workspaceId, conversationId).catch(() => undefined);
    return () => {
      if (connection.state === HubConnectionState.Connected) void connection.invoke("LeaveConversation", conversationId).catch(() => undefined);
    };
  }, [connection, status, workspaceId, conversationId]);
}
