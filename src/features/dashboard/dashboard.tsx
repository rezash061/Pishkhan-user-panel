"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Hand, MailOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { InstagramIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useChannels } from "@/features/channels/data";
import { useQuickReplies } from "@/features/inbox/data";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/i18n/digits";
import { P } from "@/lib/permissions";
import { channelTone } from "@/features/channels/status";

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

function Kpi({ label, value, href, icon }: { label: string; value: string | undefined; href: string; icon: ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl border bg-surface p-4 transition-colors hover:border-primary/40">
      <div className="mb-3 grid size-9 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{icon}</div>
      <div className="text-2xl font-bold">{value ?? <Skeleton className="h-8 w-10" />}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}

export function Dashboard() {
  const t = useTranslations();
  const { workspace, me, can } = useWorkspace();
  const ws = workspace.id;
  const base = `/w/${ws}`;
  const inbox = can(P.inboxRead);
  const handedOff = useCount(ws, { status: "handed_off" }, inbox);
  const unread = useCount(ws, { unread: true }, inbox);
  const open = useCount(ws, { status: "open" }, inbox);
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

      {inbox ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label={t("dashboard.handedOff")} value={handedOff.data} href={`${base}/inbox?filter=handed_off`} icon={<Hand />} />
          <Kpi label={t("dashboard.unread")} value={unread.data} href={`${base}/inbox?filter=unread`} icon={<MailOpen />} />
          <Kpi label={t("dashboard.open")} value={open.data} href={`${base}/inbox`} icon={<InstagramIcon />} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dashboard.channels")} />
          <CardBody className="space-y-2">
            {channels.isPending ? <Skeleton className="h-10" /> : null}
            {channels.data?.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.noChannels")}</p> : null}
            {channels.data?.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
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
