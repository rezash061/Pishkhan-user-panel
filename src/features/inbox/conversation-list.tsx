"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { BotOff, Hand, Inbox as InboxIcon, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { Conversation } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { contactTitle } from "./contact";
import { inboxFilters, useConversations, type InboxFilter } from "./data";

const ROW_HEIGHT = 76;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

/** Conversation list with filters, infinite scroll and a virtualized body (thousands of rows on mid-range phones). */
export function ConversationList() {
  const t = useTranslations("inbox");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams<{ conversationId?: string }>();
  const filter = (inboxFilters as string[]).includes(search.get("filter") ?? "") ? (search.get("filter") as InboxFilter) : "all";
  const [q, setQ] = useState("");
  const searchText = useDeferredValue(q.trim());
  const query = useConversations(workspace.id, filter, searchText);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const base = `/w/${workspace.id}/inbox`;
  const suffix = filter === "all" ? "" : `?filter=${filter}`;

  const virtualizer = useVirtualizer({
    count: items.length + (query.hasNextPage ? 1 : 0),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? -1;

  useEffect(() => {
    if (lastIndex >= items.length - 1 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [lastIndex, items.length, query]);

  // j / k move between conversations on desktop (plan 2.4 keyboard shortcuts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || (e.key !== "j" && e.key !== "k")) return;
      const index = items.findIndex((c) => c.id === params.conversationId);
      const next = items[e.key === "j" ? index + 1 : Math.max(0, index - 1)];
      if (next) {
        e.preventDefault();
        router.push(`${base}/${next.id}${suffix}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, params.conversationId, router, base, suffix]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-3 pt-3">
        <h1 className="px-1 pb-2 text-lg font-bold">{t("title")}</h1>
        <div className="relative pb-2">
          <Search className="pointer-events-none absolute start-3 top-[calc(50%-0.25rem)] size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("search")} placeholder={t("searchPlaceholder")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div role="tablist" aria-label={t("title")} className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-thin">
          {inboxFilters.map((f) => (
            <Link
              key={f}
              role="tab"
              aria-selected={f === filter}
              href={f === "all" ? base : `${base}?filter=${f}`}
              replace
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
                f === filter ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${f}`)}
            </Link>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {query.isPending ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState title={errorMessage(query.error)} action={<Button variant="outline" onClick={() => query.refetch()}>{tc("retry")}</Button>} />
        ) : items.length === 0 ? (
          searchText ? (
          <EmptyState icon={<Search />} title={t("noResults")} body={t("noResultsBody")} />
        ) : (
          <EmptyState icon={<InboxIcon />} title={t("empty")} body={filter === "all" ? t("emptyAll") : undefined} />
        )
        ) : (
          <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((row) => {
              const c = items[row.index];
              return (
                <li key={row.key} className="absolute inset-x-0" style={{ top: row.start, height: row.size }}>
                  {c ? <Row conversation={c} href={`${base}/${c.id}${suffix}`} active={c.id === params.conversationId} /> : <Skeleton className="m-2 h-14" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ conversation: c, href, active }: { conversation: Conversation; href: string; active: boolean }) {
  const t = useTranslations("inbox");
  const { title } = contactTitle(c, (id) => t("customer", { id }));
  const unread = c.unreadCount > 0;
  const time = c.lastInboundAt ?? c.lastOutboundAt;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-full items-center gap-3 border-b px-3 transition-colors", active ? "bg-primary-soft" : "hover:bg-surface-muted")}
    >
      <Avatar name={title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-bold" : "font-medium")} dir="auto">
            {title}
          </span>
          {time ? <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(time)}</span> : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>{c.lastMessagePreview || t("noPreview")}</span>
          {c.status === "handed_off" ? (
            <Badge tone="warning" title={t("status.handed_off")}>
              <Hand className="size-3" aria-hidden />
              <span className="sr-only">{t("status.handed_off")}</span>
            </Badge>
          ) : null}
          {c.aiPaused && c.status !== "handed_off" ? <BotOff className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("aiPaused")} /> : null}
          {unread ? (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground" aria-label={t("unreadCount", { count: c.unreadCount })}>
              {toPersianDigits(c.unreadCount)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
