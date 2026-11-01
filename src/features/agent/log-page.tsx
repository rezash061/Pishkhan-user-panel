"use client";

import { ScrollText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { useHandoffReason } from "@/features/inbox/handoff-reason";
import { useWorkspace } from "@/features/workspace/context";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { outcomes, useTraces } from "./data";

export const outcomeTone = { sent: "success", handed_off: "warning", failed: "danger" } as const;
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${toPersianDigits(Math.round(v * 100))}٪`);

/** «گزارش پاسخ‌ها»: every turn the AI handled, newest first, with what it did and how sure it was. */
export function AgentLogPage() {
  const t = useTranslations("agent.log");
  const errorMessage = useErrorMessage();
  const reasonLabel = useHandoffReason();
  const { workspace } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const outcome = params.get("outcome") ?? "";
  const conversationId = params.get("conversation") ?? "";
  const traces = useTraces(workspace.id, { outcome, conversationId });
  const items = traces.data?.pages.flatMap((p) => p.items) ?? [];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={t("outcome")}
          value={outcome as "" | (typeof outcomes)[number]}
          onChange={(v) => setParam("outcome", v)}
          options={[{ value: "" as const, label: t("all") }, ...outcomes.map((o) => ({ value: o, label: t(`outcomes.${o}`) }))]}
        />
        {conversationId ? (
          <Button variant="outline" size="sm" onClick={() => setParam("conversation", "")}>
            {t("oneConversation")}
            <X aria-hidden />
            <span className="sr-only">{t("clearConversation")}</span>
          </Button>
        ) : null}
      </div>

      <Card className={cn("divide-y overflow-hidden", traces.isPlaceholderData && "opacity-60")}>
        {traces.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : traces.isError ? (
          <EmptyState title={errorMessage(traces.error)} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ScrollText />} title={outcome || conversationId ? t("noResults") : t("empty")} body={outcome || conversationId ? undefined : t("emptyBody")} />
        ) : (
          items.map((x) => (
            <Link key={x.id} href={`/w/${workspace.id}/agent/log/${x.id}`} className="block space-y-1.5 p-3 hover:bg-surface-muted/50 sm:p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={outcomeTone[x.outcome as keyof typeof outcomeTone] ?? "neutral"}>{t.has(`outcomes.${x.outcome}`) ? t(`outcomes.${x.outcome}` as "outcomes.sent") : x.outcome}</Badge>
                {x.handoffReason ? <span className="text-muted-foreground">{reasonLabel(`ai:${x.handoffReason}`)}</span> : null}
                <time dateTime={x.createdAt} title={formatDateTime(x.createdAt)} className="ms-auto text-xs text-muted-foreground">
                  {formatRelative(x.createdAt)}
                </time>
              </p>
              <p className="line-clamp-2 text-sm font-medium" dir="auto">
                {x.input}
              </p>
              {x.reply ? (
                <p className="line-clamp-2 text-sm text-muted-foreground" dir="auto">
                  ↩ {x.reply}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("confidenceLine", { value: pct(x.confidence), threshold: pct(x.threshold) })}
                {x.intent ? ` · ${t.has(`intents.${x.intent}`) ? t(`intents.${x.intent}` as "intents.other") : x.intent}` : null}
                {` · ${t("seconds", { n: toPersianDigits((x.latencyMs / 1000).toFixed(1)) })}`}
              </p>
            </Link>
          ))
        )}
      </Card>
      {traces.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => traces.fetchNextPage()} loading={traces.isFetchingNextPage}>
            {t("more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
