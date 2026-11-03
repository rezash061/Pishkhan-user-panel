"use client";

import { AlarmClock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import type { FollowUp } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { followUpStatuses, useCancelFollowUp, useFollowUps, type FollowUpStatus } from "./followups-data";

const tones = { pending: "primary", sent: "success", cancelled: "neutral", skipped: "warning" } as const;

/** «پیگیری‌ها» (plan 3.6): follow-ups scheduled by rules and flows, by status, with cancel for pending ones (BE-1.8). */
export function FollowUpsPage() {
  const t = useTranslations("automations.followups");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const status = (followUpStatuses as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as FollowUpStatus) : "pending";
  const list = useFollowUps(workspace.id, { status });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <Segmented<FollowUpStatus>
        label={t("filter")}
        value={status}
        onChange={(s) => router.replace(`?status=${s}`, { scroll: false })}
        options={followUpStatuses.map((s) => ({ value: s, label: t(`statuses.${s}`) }))}
      />
      <Card className="divide-y overflow-hidden">
        {list.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : list.isError ? (
          <EmptyState title={errorMessage(list.error)} />
        ) : list.data.length === 0 ? (
          <EmptyState icon={<AlarmClock />} title={t(`empty.${status}`)} body={status === "pending" ? t("emptyBody") : undefined} />
        ) : (
          <ul className="divide-y">
            {list.data.map((f) => (
              <FollowUpRow key={f.id} followUp={f} writable={can(P.automationWrite)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function FollowUpRow({ followUp: f, writable, showConversation = true }: { followUp: FollowUp; writable: boolean; showConversation?: boolean }) {
  const t = useTranslations("automations.followups");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const cancel = useCancelFollowUp(workspace.id);
  const [confirming, setConfirming] = useState(false);
  const status = f.status as FollowUpStatus;
  const when = f.status === "pending" ? t("due", { when: formatDateTime(f.dueAt) }) : f.completedAt ? t("at", { when: formatDateTime(f.completedAt) }) : t("due", { when: formatDateTime(f.dueAt) });
  const reason = f.reason ? (t.has(`reasons.${f.reason}`) ? t(`reasons.${f.reason}` as "reasons.owner") : f.reason) : null;
  const source = f.source.startsWith("flow:") ? t("fromFlow") : t("fromRule");

  return (
    <li className="space-y-1.5 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tones[status] ?? "neutral"}>{t.has(`statuses.${f.status}`) ? t(`statuses.${f.status}` as "statuses.pending") : f.status}</Badge>
        <span className="font-medium">{when}</span>
        <span className="text-xs text-muted-foreground">
          {source} · {t("created", { when: formatRelative(f.createdAt) })}
        </span>
      </div>
      <p className="line-clamp-3 text-sm" dir="auto">
        {f.message.text}
      </p>
      {reason ? <p className="text-xs text-muted-foreground">{t("reason", { reason })}</p> : null}
      {f.status === "pending" ? (
        <p className="text-xs text-muted-foreground">
          {[f.cancelOnReply ? t("cancelsOnReply") : null, f.cancelOnPurchase ? t("cancelsOnPurchase") : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {showConversation ? (
          <Link href={`/w/${workspace.id}/inbox/${f.conversationId}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <MessageCircle className="size-3.5" aria-hidden />
            {t("conversation")}
          </Link>
        ) : null}
        {f.status === "pending" && writable ? (
          <Button size="sm" variant="ghost" className="h-auto px-0 text-danger" onClick={() => setConfirming(true)}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        danger
        title={t("cancelTitle")}
        body={t("cancelBody")}
        confirmLabel={t("cancel")}
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(f.id, {
            onSuccess: () => toast.success(t("cancelled")),
            onError: (err) => toast.error(errorMessage(err)),
            onSettled: () => setConfirming(false),
          })
        }
      />
    </li>
  );
}

/** A conversation's pending follow-ups, for the inbox side panel. Renders nothing when there are none. */
export function ConversationFollowUps({ conversationId }: { conversationId: string }) {
  const t = useTranslations("automations.followups");
  const { workspace, can } = useWorkspace();
  const list = useFollowUps(workspace.id, { status: "pending", conversationId, limit: 10 }, can(P.settingsRead));
  if (!list.data?.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("sidePanel")}</h3>
      <ul className="divide-y rounded-xl border [&>li]:px-3">
        {list.data.map((f) => (
          <FollowUpRow key={f.id} followUp={f} writable={can(P.automationWrite)} showConversation={false} />
        ))}
      </ul>
    </section>
  );
}
