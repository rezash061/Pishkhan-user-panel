"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { qk } from "@/lib/api/keys";
import type { Channel, Message } from "@/lib/api/types";
import { HubEvents, useHubEvent } from "@/lib/realtime/hub";
import { patchConversation, updateMessageStatus, upsertMessage } from "./data";

interface ConversationUpdated {
  id: string;
  status: string;
  assigneeId: string | null;
  aiPaused: boolean;
  lastMessage: string | null;
  unreadCount: number;
  lastInboundAt: string | null;
  windowExpiresAt: string | null;
}

const HUMAN_AGENT_DAYS = 7;

/** Applies hub events to the TanStack Query caches for the whole workspace (plan 3.3, realtime). */
export function RealtimeSync({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useTranslations("inbox");

  useHubEvent<ConversationUpdated>(HubEvents.conversationUpdated, (p) => {
    const found = patchConversation(qc, workspaceId, p.id, {
      status: p.status,
      assigneeId: p.assigneeId,
      aiPaused: p.aiPaused,
      lastMessagePreview: p.lastMessage,
      unreadCount: Number(p.unreadCount) || 0,
      lastInboundAt: p.lastInboundAt,
      windowExpiresAt: p.windowExpiresAt,
      humanAgentUntil: p.lastInboundAt ? new Date(new Date(p.lastInboundAt).getTime() + HUMAN_AGENT_DAYS * 86_400_000).toISOString() : null,
    });
    // Order and filter membership may have changed (or the conversation is new): refetch the lists in the background.
    void qc.invalidateQueries({ queryKey: qk.conversationLists(workspaceId), refetchType: found ? "active" : "all" });
  });

  useHubEvent<{ conversationId: string; message: Message }>(HubEvents.messageCreated, (p) => {
    upsertMessage(qc, workspaceId, p.conversationId, p.message);
  });

  useHubEvent<{ conversationId: string; messageId: string; status: string; errorCode: string | null; upTo: boolean }>(HubEvents.messageStatus, (p) => {
    updateMessageStatus(qc, workspaceId, p.conversationId, p.messageId, p.status, p.errorCode, p.upTo);
  });

  useHubEvent<{ conversationId: string; reason: string; suggestedReply: string | null }>(HubEvents.handoffRequested, (p) => {
    toast(t("handoffToast"), {
      action: { label: t("open"), onClick: () => router.push(`/w/${workspaceId}/inbox/${p.conversationId}`) },
      duration: 10_000,
    });
    if ("vibrate" in navigator) navigator.vibrate?.(200);
  });

  useHubEvent<{ channelAccountId: string; status: string; reason: string | null }>(HubEvents.channelStatus, (p) => {
    qc.setQueryData<Channel[]>(qk.channels(workspaceId), (old) => old?.map((c) => (c.id === p.channelAccountId ? { ...c, status: p.status, statusReason: p.reason } : c)));
    void qc.invalidateQueries({ queryKey: qk.channels(workspaceId) });
  });

  return null;
}
