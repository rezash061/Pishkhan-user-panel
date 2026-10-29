"use client";

import { ChevronDown, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { InstagramIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import type { Channel } from "@/lib/api/types";
import { formatDate } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { startInstagramConnect } from "./connect";
import { useChannelMedia, useChannels, useDisconnectChannel } from "./data";
import { OAuthResult } from "./oauth-result";
import { channelTone } from "./status";

export function ChannelsPage({ status, reason, channelId }: { status: string | null; reason: string | null; channelId: string | null }) {
  const t = useTranslations("channels");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const channels = useChannels(workspace.id);
  const disconnect = useDisconnectChannel(workspace.id);
  const manage = can(P.channelsManage);
  const [connecting, setConnecting] = useState(false);
  const [confirm, setConfirm] = useState<Channel | null>(null);

  const connect = async () => {
    setConnecting(true);
    try {
      await startInstagramConnect(workspace.id, "channels");
    } catch (e) {
      toast.error(errorMessage(e));
      setConnecting(false);
    }
  };

  const connected = channels.data?.find((c) => c.id === channelId);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          manage ? (
            <Button onClick={connect} loading={connecting}>
              {connecting ? null : <InstagramIcon className="size-4" />}
              {t("connect")}
            </Button>
          ) : null
        }
      />
      <div className="space-y-4">
        <OAuthResult status={status} reason={reason} username={connected?.username} />
        {channels.isPending ? (
          <Skeleton className="h-24" />
        ) : channels.isError ? (
          <Card>
            <EmptyState title={errorMessage(channels.error)} />
          </Card>
        ) : channels.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PlugZap />}
              title={t("empty")}
              body={t("emptyHint")}
              action={
                manage ? (
                  <Button onClick={connect} loading={connecting}>
                    {t("connect")}
                  </Button>
                ) : null
              }
            />
          </Card>
        ) : (
          channels.data.map((c) => <ChannelCard key={c.id} channel={c} manage={manage} onReconnect={connect} onDisconnect={() => setConfirm(c)} />)
        )}
        <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        danger
        title={t("disconnect")}
        body={confirm ? t("disconnectConfirm", { username: confirm.username ?? confirm.externalId }) : null}
        confirmLabel={t("disconnect")}
        loading={disconnect.isPending}
        onConfirm={() =>
          confirm &&
          disconnect.mutate(confirm.id, {
            onSuccess: () => setConfirm(null),
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </PageContainer>
  );
}

function ChannelCard({ channel: c, manage, onReconnect, onDisconnect }: { channel: Channel; manage: boolean; onReconnect: () => void; onDisconnect: () => void }) {
  const t = useTranslations("channels");
  const { workspace, can } = useWorkspace();
  const [showMedia, setShowMedia] = useState(false);
  const media = useChannelMedia(workspace.id, c.id, showMedia);
  const needsReauth = c.status === "reauth_required" || c.status === "token_expiring";

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.65_0.22_20)] to-[oklch(0.55_0.22_310)] text-white">
            <InstagramIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold" dir="ltr" style={{ textAlign: "right" }}>
              @{c.username ?? c.externalId}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.displayName ? `${c.displayName} · ` : ""}
              {t("connectedSince", { date: formatDate(c.createdAt) })}
            </p>
          </div>
          <Badge tone={channelTone(c.status)}>{t(`status.${c.status}` as "status.active")}</Badge>
        </div>
        {c.tokenExpiresAt ? <p className="text-xs text-muted-foreground">{t("tokenExpires", { date: formatDate(c.tokenExpiresAt) })}</p> : null}
        <div className="flex flex-wrap gap-2">
          {manage && needsReauth ? (
            <Button size="sm" onClick={onReconnect}>
              <RefreshCw aria-hidden />
              {t("reconnect")}
            </Button>
          ) : null}
          {can(P.automationWrite) ? (
            <Button size="sm" variant="outline" onClick={() => setShowMedia((v) => !v)} aria-expanded={showMedia}>
              <ChevronDown className={showMedia ? "rotate-180" : ""} aria-hidden />
              {t("media")}
            </Button>
          ) : null}
          {manage ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={onDisconnect}>
              <Unplug aria-hidden />
              {t("disconnect")}
            </Button>
          ) : null}
        </div>
        {showMedia ? (
          media.isPending ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : media.data && media.data.items.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {media.data.items.map((m) => (
                <a key={m.id} href={m.permalink ?? undefined} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-xl bg-surface-muted">
                  {m.thumbnailUrl || m.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Meta CDN thumbnails; not worth proxying through next/image.
                    <img src={(m.thumbnailUrl ?? m.mediaUrl)!} alt={m.caption?.slice(0, 80) ?? ""} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform group-hover:scale-105" />
                  ) : null}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noMedia")}</p>
          )
        ) : null}
      </CardBody>
    </Card>
  );
}
