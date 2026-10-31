"use client";

import { AlertTriangle, Bell, BellOff, CheckCheck, Hand, Workflow, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { AppNotification } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { notificationHref, useMarkNotificationRead, useNotifications, useUnreadNotifications } from "./data";

const kindIcons: Record<string, LucideIcon> = { handoff: Hand, automation: Workflow, channel: AlertTriangle };

/** Bell with the unread count; opens the caller's notifications for this workspace. */
export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("notifications");
  const { workspace } = useWorkspace();
  const unread = useUnreadNotifications(workspace.id).data ?? 0;
  const [open, setOpen] = useState(false);
  const label = unread ? t("bellUnread", { count: unread }) : t("bell");

  return (
    <>
      <button type="button" aria-label={label} title={label} onClick={() => setOpen(true)} className={cn("relative grid size-9 place-items-center rounded-full hover:bg-surface-muted", className)}>
        <Bell className="size-5" aria-hidden />
        {unread ? (
          <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" aria-hidden>
            {unread > 99 ? "۹۹+" : toPersianDigits(unread)}
          </span>
        ) : null}
      </button>
      {open ? <NotificationsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("notifications");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const list = useNotifications(ws, true);
  const mark = useMarkNotificationRead(ws);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = list.data?.pages[0]?.unreadCount ?? 0;

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      title={t("title")}
      footer={
        <Link href={`/w/${ws}/settings/notifications`} onClick={onClose} className="text-sm text-primary hover:underline">
          {t("settingsLink")}
        </Link>
      }
    >
      <div className="space-y-3">
        {unread ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" loading={mark.isPending} onClick={() => mark.mutate("all", { onError: (e) => toast.error(errorMessage(e)) })}>
              <CheckCheck aria-hidden />
              {t("readAll")}
            </Button>
          </div>
        ) : null}
        {list.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : list.isError ? (
          <EmptyState title={errorMessage(list.error)} />
        ) : items.length === 0 ? (
          <EmptyState icon={<BellOff />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <ul className="divide-y rounded-2xl border">
            {items.map((n) => (
              <li key={n.id}>
                <Item notification={n} onOpen={() => (n.readAt ? onClose() : mark.mutate(n.id, { onSettled: onClose }))} />
              </li>
            ))}
          </ul>
        )}
        {list.hasNextPage ? (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
              {t("more")}
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function Item({ notification: n, onOpen }: { notification: AppNotification; onOpen: () => void }) {
  const t = useTranslations("notifications");
  const { workspace } = useWorkspace();
  const href = notificationHref(workspace.id, n.link);
  const Icon = kindIcons[n.kind] ?? Bell;
  const body = (
    <>
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", n.kind === "channel" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className={cn("block text-sm", n.readAt ? "text-muted-foreground" : "font-semibold")} dir="auto">
          {n.title}
        </span>
        {n.body ? (
          <span className="block line-clamp-2 text-xs text-muted-foreground" dir="auto">
            {n.body}
          </span>
        ) : null}
        <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="block text-[11px] text-muted-foreground">
          {formatRelative(n.createdAt)}
        </time>
      </span>
      {!n.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label={t("unread")} /> : null}
    </>
  );
  const className = "flex items-start gap-3 p-3 text-start hover:bg-surface-muted";
  return href ? (
    <Link href={href} onClick={onOpen} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={cn(className, "w-full")}>
      {body}
    </button>
  );
}
