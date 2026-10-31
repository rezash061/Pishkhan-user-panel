"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Hand, MailOpen, Moon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { InstagramIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { PageContainer } from "@/components/ui/page";
import { useChannels } from "@/features/channels/data";
import { useQuickReplies } from "@/features/inbox/data";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import type { Dashboard as DashboardData } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatRelative } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { P } from "@/lib/permissions";
import { channelTone } from "@/features/channels/status";
import { DailyReplies, RepliesBreakdown, ranges, useDashboard, type Range } from "./activity";

const COUNT_LIMIT = 50;

/** Conversation count for a filter, from the first page («۵۰+» when there are more). */
function useCount(ws: string, query: { status?: string; unread?: boolean }, enabled: boolean) {
  return useQuery({
    queryKey: ["conversation-count", ws, query],
    enabled,
    queryFn: async () => {
      const page = unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/conversations", { params: { path: { workspaceId: ws }, query: { ...query, limit: COUNT_LIMIT } } }));
      return page.nextCursor ? `${toPersianDigits(COUNT_LIMIT)}+` : toPersianDigits(page.items.length);
    },
  });
}

function Kpi({ label, value, href, icon, hint }: { label: string; value: string | undefined; href: string; icon: ReactNode; hint?: string | null }) {
  return (
    <Link href={href} className="block rounded-2xl border bg-surface p-4 transition-colors hover:border-primary/40">
      <div className="mb-3 grid size-9 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{icon}</div>
      <div className="text-2xl font-bold tabular-nums">{value ?? <Skeleton className="h-8 w-10" />}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** Inbox counts for members without analytics access (agents): from the conversations list, as before. */
function InboxCounts({ ws, base }: { ws: string; base: string }) {
  const t = useTranslations("dashboard");
  const handedOff = useCount(ws, { status: "handed_off" }, true);
  const unread = useCount(ws, { unread: true }, true);
  const open = useCount(ws, { status: "open" }, true);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Kpi label={t("handedOff")} value={handedOff.data} href={`${base}/inbox?filter=handed_off`} icon={<Hand />} />
      <Kpi label={t("unread")} value={unread.data} href={`${base}/inbox?filter=unread`} icon={<MailOpen />} />
      <Kpi label={t("open")} value={open.data} href={`${base}/inbox`} icon={<InstagramIcon />} />
    </div>
  );
}

function Overnight({ data }: { data: NonNullable<DashboardData["overnight"]> }) {
  const t = useTranslations("dashboard");
  return (
    <Card className="bg-gradient-to-l from-primary-soft to-surface">
      <CardBody className="flex items-start gap-3">
        <Moon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {t("overnight")}
            {data.ongoing ? <Badge tone="primary">{t("overnightOngoing")}</Badge> : null}
          </p>
          <p className="text-sm">{data.text}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function Activity({ data, range, onRange }: { data: DashboardData; range: Range; onRange: (r: Range) => void }) {
  const t = useTranslations("dashboard.activity");
  const share = data.totals.automatedShare;
  return (
    <Card>
      <CardHeader title={t("title")} description={t("lag")} action={<Segmented<Range> label={t("range")} value={range} onChange={onRange} options={ranges.map((r) => ({ value: r, label: t(`ranges.${r}`) }))} />} />
      <CardBody className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("messagesReceived")} value={formatNumber(data.totals.messagesReceived)} />
          <Stat label={t("newConversations")} value={formatNumber(data.totals.newConversations)} />
          <Stat label={t("automatedShare")} value={share === null ? "—" : `٪${toPersianDigits(Math.round(share * 100))}`} />
          <Stat label={t("handoffs")} value={formatNumber(data.totals.handoffs)} />
        </dl>
        <RepliesBreakdown totals={data.totals} />
        {data.days.length > 1 ? <DailyReplies days={data.days} /> : null}
      </CardBody>
    </Card>
  );
}

export function Dashboard() {
  const t = useTranslations();
  const { workspace, me, can } = useWorkspace();
  const ws = workspace.id;
  const base = `/w/${ws}`;
  const inbox = can(P.inboxRead);
  const analytics = can(P.analyticsRead);
  const [range, setRange] = useState<Range>("today");
  const dashboard = useDashboard(ws, range, analytics);
  const data = dashboard.data;
  const channels = useChannels(ws);
  const members = useMembers(ws);
  const quick = useQuickReplies(ws, inbox);

  const setup = [
    { done: (channels.data?.length ?? 0) > 0, label: t("dashboard.setupConnect"), href: `${base}/channels` },
    { done: (members.data?.length ?? 0) > 1, label: t("dashboard.setupTeam"), href: `${base}/team` },
    { done: false, label: t("dashboard.setupHours"), href: `${base}/settings/business-hours` },
    { done: (quick.data?.length ?? 0) > 0, label: t("dashboard.setupQuick"), href: `${base}/settings/quick-replies` },
  ];

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{me.displayName ? t("dashboard.greeting", { name: me.displayName }) : t("dashboard.greetingNoName")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle", { workspace: workspace.name })}</p>
      </div>

      {data?.overnight ? <Overnight data={data.overnight} /> : null}

      {analytics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi
            label={t("dashboard.handedOff")}
            value={data ? toPersianDigits(data.inbox.handedOff) : undefined}
            href={`${base}/inbox?filter=handed_off`}
            icon={<Hand />}
            hint={data?.inbox.oldestHandoffAt ? t("dashboard.oldestWait", { time: formatRelative(data.inbox.oldestHandoffAt) }) : null}
          />
          <Kpi label={t("dashboard.unread")} value={data ? toPersianDigits(data.inbox.unread) : undefined} href={`${base}/inbox?filter=unread`} icon={<MailOpen />} />
          <Kpi label={t("dashboard.open")} value={data ? toPersianDigits(data.inbox.open) : undefined} href={`${base}/inbox`} icon={<InstagramIcon />} />
        </div>
      ) : inbox ? (
        <InboxCounts ws={ws} base={base} />
      ) : null}

      {analytics ? data ? <Activity data={data} range={range} onRange={setRange} /> : dashboard.isError ? null : <Skeleton className="h-64" /> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dashboard.channels")} />
          <CardBody className="space-y-2">
            {channels.isPending ? <Skeleton className="h-10" /> : null}
            {channels.data?.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.noChannels")}</p> : null}
            {channels.data?.map((c) => (
              <div key={c.id} className={cn("flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5", data?.channels.find((h) => h.id === c.id)?.healthy === false && "ring-1 ring-danger/50")}>
                <InstagramIcon className="size-5 text-primary" />
                <span className="flex-1 truncate text-sm font-medium" dir="ltr">
                  @{c.username ?? c.externalId}
                </span>
                <Badge tone={channelTone(c.status)}>{t(`channels.status.${c.status}` as "channels.status.active")}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("dashboard.setup")} />
          <CardBody>
            <ul className="space-y-1">
              {setup.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-muted">
                    {item.done ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card className="bg-gradient-to-l from-primary-soft to-surface">
        <CardBody className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">{t("dashboard.comingTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.comingBody")}</p>
          </div>
        </CardBody>
      </Card>

      {inbox ? (
        <Link href={`${base}/inbox`} className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
          {t("dashboard.goInbox")}
        </Link>
      ) : null}
    </PageContainer>
  );
}
