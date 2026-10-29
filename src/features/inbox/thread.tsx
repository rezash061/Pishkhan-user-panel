"use client";

import { useTranslations } from "next-intl";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { formatDayLabel, inTehran } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { useMessages, type OptimisticMessage } from "./data";
import { MessageBubble } from "./message-bubble";

function dayKey(iso: string): string {
  const d = inTehran(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Messages oldest → newest with Jalali day separators; keeps the view pinned to the bottom unless the user scrolled up. */
export function Thread({
  workspaceId,
  conversationId,
  senderName,
  onRetry,
  onNewInbound,
}: {
  workspaceId: string;
  conversationId: string;
  senderName: (userId: string | null) => string;
  onRetry: (message: OptimisticMessage) => void;
  onNewInbound: () => void;
}) {
  const t = useTranslations("inbox");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const query = useMessages(workspaceId, conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const previousHeight = useRef(0);
  const loadingOlder = useRef(false);

  const messages = useMemo(() => (query.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse(), [query.data]);
  const newest = messages.at(-1);

  // New inbound message while the thread is open: mark it read for the team.
  const lastInboundId = useMemo(() => [...messages].reverse().find((m) => m.direction === "inbound")?.id, [messages]);
  const onNewInboundRef = useRef(onNewInbound);
  useEffect(() => {
    onNewInboundRef.current = onNewInbound;
  });
  useEffect(() => {
    if (lastInboundId) onNewInboundRef.current();
  }, [lastInboundId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loadingOlder.current) {
      // Keep the same message under the reader's eyes after older pages are prepended.
      el.scrollTop += el.scrollHeight - previousHeight.current;
      loadingOlder.current = false;
    } else if (pinned.current) {
      el.scrollTop = el.scrollHeight;
    }
    previousHeight.current = el.scrollHeight;
  }, [messages.length, newest?.id, newest?.status]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = () => {
    loadingOlder.current = true;
    previousHeight.current = scrollRef.current?.scrollHeight ?? 0;
    void query.fetchNextPage();
  };

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 scrollbar-thin sm:px-6" aria-live="polite" aria-relevant="additions">
      {query.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="ms-auto h-10 w-1/2" />
          <Skeleton className="h-10 w-3/5" />
        </div>
      ) : query.isError ? (
        <EmptyState title={errorMessage(query.error)} action={<Button variant="outline" onClick={() => query.refetch()}>{tc("retry")}</Button>} />
      ) : messages.length === 0 ? (
        <EmptyState title={t("noMessages")} />
      ) : (
        <div className="space-y-2">
          {query.hasNextPage ? (
            <div className="flex justify-center pb-2">
              <Button variant="outline" size="sm" onClick={loadOlder} loading={query.isFetchingNextPage}>
                {t("loadOlder")}
              </Button>
            </div>
          ) : null}
          {messages.map((m, i) => {
            const previous = messages[i - 1];
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(m.createdAt);
            return (
              <Fragment key={m.id}>
                {newDay ? (
                  <div className="sticky top-0 z-10 flex justify-center py-1">
                    <span className="rounded-full bg-surface/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">{formatDayLabel(m.createdAt)}</span>
                  </div>
                ) : null}
                <MessageBubble message={m} senderName={senderName} onRetry={m.local === "failed" ? () => onRetry(m) : undefined} />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
