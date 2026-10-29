"use client";

import { ArrowRight, Bot, BotOff, CheckCircle2, Hand, Info, RotateCcw, UserCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import type { ConversationStatus } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useJoinConversation } from "@/lib/realtime/hub";
import { Composer, type ComposerHandle } from "./composer";
import { contactLabel } from "./contact";
import { newLocalMessage, useAiPause, useAssign, useChangeStatus, useConversation, useMarkRead, useQuickReplies, useSendMessage, type OptimisticMessage } from "./data";
import { SidePanel } from "./side-panel";
import { Thread } from "./thread";

const statusTone = { open: "primary", pending: "neutral", handed_off: "warning", closed: "neutral" } as const;

export function ConversationView({ conversationId }: { conversationId: string }) {
  const t = useTranslations("inbox");
  const errorMessage = useErrorMessage();
  const { workspace, me, can } = useWorkspace();
  const ws = workspace.id;
  const search = useSearchParams();
  const backHref = `/w/${ws}/inbox${search.get("filter") ? `?filter=${search.get("filter")}` : ""}`;
  const canReply = can(P.inboxReply);

  const conversation = useConversation(ws, conversationId);
  const members = useMembers(ws);
  const quickReplies = useQuickReplies(ws);
  const send = useSendMessage(ws, conversationId, me.id);
  const assign = useAssign(ws, conversationId);
  const changeStatus = useChangeStatus(ws, conversationId);
  const aiPause = useAiPause(ws, conversationId);
  const markRead = useMarkRead(ws, conversationId);
  const composer = useRef<ComposerHandle>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useJoinConversation(ws, conversationId);

  const fail = (e: unknown) => toast.error(errorMessage(e));

  const senderName = useCallback(
    (userId: string | null) => {
      if (userId && userId === me.id) return t("handledBy.you");
      return members.data?.find((m) => m.userId === userId)?.displayName || t("handledBy.teammate");
    },
    [members.data, me, t],
  );

  const c = conversation.data;
  const markReadMutate = markRead.mutate;
  // The thread is on screen: a newly arrived customer message counts as read by the team.
  const onNewInbound = useCallback(() => {
    if (document.visibilityState === "visible") markReadMutate();
  }, [markReadMutate]);

  const sendText = (text: string) => {
    const local = newLocalMessage();
    send.mutate({ text, ...local }, { onError: fail });
  };

  const retry = (message: OptimisticMessage) => {
    if (!message.text) return;
    // Same idempotency chain is not available after a failure response, so a retry is a new send of the same text.
    sendText(message.text);
  };

  const setStatus = (status: ConversationStatus) => changeStatus.mutate(status, { onError: fail });

  // r: reply, e: close, a: assign to me (desktop shortcuts, plan 2.4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))) return;
      if (!canReply || !c) return;
      if (e.key === "r") {
        e.preventDefault();
        composer.current?.focus();
      } else if (e.key === "e" && c.status !== "closed") {
        changeStatus.mutate("closed", { onError: fail });
      } else if (e.key === "a" && c.assigneeId !== me.id) {
        assign.mutate(me.id, { onError: fail });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (conversation.isPending) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (conversation.isError || !c) {
    return <EmptyState title={errorMessage(conversation.error)} action={<Link href={backHref} className="text-primary hover:underline">{t("actions.backToList")}</Link>} />;
  }

  const name = contactLabel(c.contactId);

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col" aria-label={t("customer", { id: name })}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-surface px-2 sm:px-3">
          <Link href={backHref} aria-label={t("actions.backToList")} className="grid size-9 place-items-center rounded-full hover:bg-surface-muted lg:hidden">
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Avatar name={name} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t("customer", { id: name })}</p>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <Badge tone={statusTone[c.status as ConversationStatus] ?? "neutral"}>{t(`status.${c.status}` as "status.open")}</Badge>
              {c.aiPaused ? (
                <Badge title={t("aiPaused")}>
                  <BotOff className="size-3" aria-hidden />
                  <span className="max-sm:sr-only">{t("aiPaused")}</span>
                </Badge>
              ) : null}
            </div>
          </div>
          {canReply ? (
            <div className="flex items-center gap-0.5">
              {c.assigneeId !== me.id ? (
                <Button variant="ghost" size="icon-sm" title={t("actions.assignToMe")} aria-label={t("actions.assignToMe")} onClick={() => assign.mutate(me.id, { onError: fail })}>
                  <UserCheck />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                title={c.aiPaused ? t("actions.resumeAi") : t("actions.pauseAi")}
                aria-label={c.aiPaused ? t("actions.resumeAi") : t("actions.pauseAi")}
                onClick={() => aiPause.mutate(!c.aiPaused, { onError: fail })}
              >
                {c.aiPaused ? <Bot /> : <BotOff />}
              </Button>
              {c.status === "closed" ? (
                <Button variant="ghost" size="icon-sm" title={t("actions.reopen")} aria-label={t("actions.reopen")} onClick={() => setStatus("open")}>
                  <RotateCcw />
                </Button>
              ) : (
                <Button variant="ghost" size="icon-sm" title={t("actions.close")} aria-label={t("actions.close")} onClick={() => setStatus("closed")}>
                  <CheckCircle2 />
                </Button>
              )}
              {c.status !== "handed_off" && c.status !== "closed" ? (
                <Button variant="ghost" size="icon-sm" title={t("actions.handOff")} aria-label={t("actions.handOff")} onClick={() => setStatus("handed_off")}>
                  <Hand />
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button variant="ghost" size="icon-sm" className="xl:hidden" title={t("actions.details")} aria-label={t("actions.details")} onClick={() => setDetailsOpen(true)}>
            <Info />
          </Button>
        </header>

        <Thread workspaceId={ws} conversationId={conversationId} senderName={senderName} onRetry={retry} onNewInbound={onNewInbound} />

        <Composer
          ref={composer}
          conversation={c}
          canReply={canReply}
          quickReplies={quickReplies.data ?? []}
          quickRepliesHref={`/w/${ws}/settings/quick-replies`}
          onSend={sendText}
        />
      </section>

      <aside className="hidden w-80 shrink-0 overflow-y-auto border-s bg-surface xl:block">
        <SidePanel conversation={c} members={members.data ?? []} canReply={canReply} onAssign={(id) => assign.mutate(id, { onError: fail })} />
      </aside>
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} title={t("actions.details")} variant="sheet">
        <SidePanel conversation={c} members={members.data ?? []} canReply={canReply} onAssign={(id) => assign.mutate(id, { onError: fail })} />
      </Dialog>
    </div>
  );
}
