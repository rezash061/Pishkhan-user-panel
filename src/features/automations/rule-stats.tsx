"use client";

import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import type { BacklogRun, Rule, RuleStats } from "@/lib/api/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { backlogRunning as running, useRuleStats, useStartBacklog } from "./data";

const periods = ["7", "30", "90"] as const;

/** A backlog run can reply to a post's existing comments once the rule is bound to one post (backend StartBacklogAsync). */
export function canRunBacklog(rule: Rule): boolean {
  return (rule.triggerKind === "comment_keyword" || rule.triggerKind === "comment_any") && Boolean(rule.postId) && Boolean(rule.channelAccountId);
}


export function RuleStatsPanel({ rule }: { rule: Rule }) {
  const t = useTranslations("automations.stats");
  const { workspace } = useWorkspace();
  const [days, setDays] = useState<(typeof periods)[number]>("30");
  const stats = useRuleStats(workspace.id, rule.id, Number(days));

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("subtitle")}
        action={<Segmented label={t("period")} value={days} onChange={setDays} options={periods.map((p) => ({ value: p, label: t("days", { n: Number(p) }) }))} />}
      />
      <CardBody className="space-y-5">
        {stats.isPending ? (
          <Skeleton className="h-28" />
        ) : stats.isError ? (
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label={t("fired")} value={Number(stats.data.fired)} />
              {rule.triggerKind.startsWith("comment") || rule.triggerKind === "live_comment" ? (
                <>
                  <Tile label={t("privateReplies")} value={Number(stats.data.privateReplies)} />
                  <Tile label={t("publicReplies")} value={Number(stats.data.publicReplies)} />
                  <Tile label={t("queued")} value={Number(stats.data.commentsQueued)} hint={t("queuedHint")} />
                </>
              ) : (
                <Tile label={t("flowsStarted")} value={Number(stats.data.flowsStarted)} />
              )}
            </dl>
            <DailyBars stats={stats.data} />
          </>
        )}
        {canRunBacklog(rule) ? <Backlog rule={rule} run={stats.data?.latestBacklogRun ?? null} /> : null}
      </CardBody>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3" title={hint}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}

/** One series (times fired per day): single hue, thin rounded bars, a hover label per bar, and a table for screen readers. */
function DailyBars({ stats }: { stats: RuleStats }) {
  const t = useTranslations("automations.stats");
  const rows = stats.perDay.map((d) => ({ day: d.day, fired: Number(d.fired) }));
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("noActivity")}</p>;
  const max = Math.max(1, ...rows.map((r) => r.fired));
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-muted-foreground">{t("perDay")}</figcaption>
      <div className="flex h-24 items-end gap-0.5 border-b" aria-hidden dir="ltr">
        {rows.map((r) => (
          <div key={r.day} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (r.fired / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background group-hover:block" dir="rtl">
              {formatDate(`${r.day}T12:00:00Z`)}: {formatNumber(r.fired)}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("perDay")}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row">{formatDate(`${r.day}T12:00:00Z`)}</th>
              <td>{formatNumber(r.fired)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Backlog({ rule, run }: { rule: Rule; run: BacklogRun | null }) {
  const t = useTranslations("automations.backlog");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace, can } = useWorkspace();
  const start = useStartBacklog(workspace.id, rule.id);
  const active = running(run);
  const tone = run?.status === "completed" ? "success" : run?.status === "failed" ? "danger" : "primary";

  return (
    <div className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4 text-primary" aria-hidden />
            {t("title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
        {can(P.automationWrite) ? (
          <Button
            variant="secondary"
            size="sm"
            loading={start.isPending}
            disabled={active || !rule.enabled}
            title={!rule.enabled ? t("disabled") : undefined}
            onClick={() => start.mutate(undefined, { onSuccess: () => toast.success(t("started")), onError: (e) => toast.error(errorMessage(e)) })}
          >
            {active ? t("running") : t("start")}
          </Button>
        ) : null}
      </div>
      {run ? (
        <div className="space-y-2" role="status">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={tone}>{t(`status.${run.status}` as "status.running")}</Badge>
            <span className="text-muted-foreground">{formatRelative(run.createdAt)}</span>
          </div>
          {active ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full w-1/3 animate-[pk-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          ) : null}
          <p className="text-sm">
            {t("progress", { seen: formatNumber(Number(run.commentsSeen)), queued: formatNumber(Number(run.commentsQueued)), pages: formatNumber(Number(run.pages)) })}
          </p>
          {run.error ? <p className="text-xs text-danger">{codeMessage(run.error) ?? t("failed")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
