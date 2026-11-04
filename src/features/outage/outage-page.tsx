"use client";

import { Info, MessageSquareText, Send, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { OutageCampaign } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { newIdempotencyKey, useCampaignAudience, useCampaigns, useOutageStatus, useStartCampaign } from "./data";
import { CAMPAIGN_MAX, campaignTextValid, hasLink, isDown, smsBody, smsParts } from "./model";

const tones = { sending: "primary", completed: "success", limit_reached: "warning" } as const;

/**
 * «انتقال مشتری‌ها» (plan 3.10 outage center, BE-2.7): while Instagram is down, one SMS to every customer who agreed to
 * SMS, with the shop's name in front, pointing them somewhere they can still reach the shop. Once per 24 hours.
 */
export function OutagePage() {
  const t = useTranslations("outage");
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const status = useOutageStatus(ws);
  const writable = can(P.crmWrite);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t("title")}
          description={t("subtitle")}
          action={status.data ? <Badge tone={isDown(status.data.status) ? "danger" : "success"}>{t(isDown(status.data.status) ? "statusDown" : "statusUp")}</Badge> : null}
        />
        <CardBody className="space-y-4">
          {status.data && isDown(status.data.status) ? <p className="text-sm text-danger">{t("downSince", { when: formatDateTime(status.data.since) })}</p> : null}
          <AudienceStats ws={ws} />
          {writable ? <Composer ws={ws} shop={workspace.name} /> : <p className="text-sm text-muted-foreground">{t("readOnly")}</p>}
        </CardBody>
      </Card>
      <History ws={ws} />
    </div>
  );
}

function AudienceStats({ ws }: { ws: string }) {
  const t = useTranslations("outage.audience");
  const errorMessage = useErrorMessage();
  const audience = useCampaignAudience(ws);
  if (audience.isPending) return <Skeleton className="h-20" />;
  if (audience.isError) return <p className="text-sm text-danger">{errorMessage(audience.error)}</p>;
  const a = audience.data;
  return (
    <dl className="grid grid-cols-3 gap-2 text-center text-sm">
      {(
        [
          ["contacts", a.contacts],
          ["withPhone", a.withPhone],
          ["reachable", a.reachable],
        ] as const
      ).map(([k, v]) => (
        <div key={k} className={cn("rounded-xl p-2", k === "reachable" ? "bg-primary-soft" : "bg-surface-muted")}>
          <dd className="text-lg font-bold tabular-nums">{formatNumber(v)}</dd>
          <dt className="text-xs text-muted-foreground">{t(k)}</dt>
        </div>
      ))}
    </dl>
  );
}

function Composer({ ws, shop }: { ws: string; shop: string }) {
  const t = useTranslations("outage");
  const errorMessage = useErrorMessage();
  const audience = useCampaignAudience(ws);
  const start = useStartCampaign(ws);
  const [text, setText] = useState("");
  const [key, setKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState(false);
  const a = audience.data;
  const body = smsBody(shop, text);
  const parts = smsParts(body);
  const valid = campaignTextValid(text);
  const nextAllowed = a?.nextAllowedAt ?? null;
  const blocked = !a?.outage || Boolean(nextAllowed) || !a?.reachable;

  const send = () =>
    start.mutate(
      { text, idempotencyKey: key },
      {
        onSuccess: (c) => {
          setConfirming(false);
          setText("");
          setKey(newIdempotencyKey());
          toast.success(t("started", { n: formatNumber(c.scanned || (a?.reachable ?? 0)) }));
        },
        onError: () => {
          setConfirming(false);
          setKey(newIdempotencyKey());
        },
      },
    );

  const error = start.error instanceof ApiError && start.error.code === "outage.campaign_cooldown" ? (nextAllowed ? t("cooldownUntil", { when: formatDateTime(nextAllowed) }) : errorMessage(start.error)) : start.error ? errorMessage(start.error) : null;

  return (
    <div className="space-y-3">
      {a && !a.outage ? (
        <p className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("onlyWhenDown")}
        </p>
      ) : null}
      {nextAllowed ? (
        <p role="status" className="rounded-xl bg-warning-soft p-3 text-sm">
          {t("cooldownUntil", { when: formatDateTime(nextAllowed) })}
        </p>
      ) : null}
      <Field label={t("text")} htmlFor="outage-text" hint={t("textHint", { max: formatNumber(CAMPAIGN_MAX) })} error={text && !valid ? t("textInvalid") : null}>
        <Textarea id="outage-text" dir="auto" rows={4} maxLength={CAMPAIGN_MAX} value={text} placeholder={t("placeholder")} onChange={(e) => setText(e.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">
        {formatNumber(text.trim().length)} / {formatNumber(CAMPAIGN_MAX)}
      </p>
      {text.trim() && !hasLink(text) ? (
        <p className="flex items-start gap-2 text-xs text-[oklch(0.45_0.11_70)] dark:text-warning">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("linkHint")}
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText className="size-4 text-primary" aria-hidden />
          {t("preview")}
        </p>
        <div className="max-w-sm rounded-2xl rounded-es-md bg-bubble-in px-3.5 py-2 text-sm leading-7 whitespace-pre-wrap" dir="auto" aria-label={t("preview")}>
          {text.trim() ? body : <span className="text-muted-foreground">{smsBody(shop, t("previewEmpty"))}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{t("parts", { n: formatNumber(parts.parts), length: formatNumber(parts.length) })}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button onClick={() => setConfirming(true)} disabled={!valid || blocked || start.isPending}>
        <Send aria-hidden />
        {t("send")}
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("confirmTitle", { n: formatNumber(a?.reachable ?? 0) })}
        body={t("confirmBody")}
        confirmLabel={t("confirmSend", { n: formatNumber(a?.reachable ?? 0) })}
        loading={start.isPending}
        onConfirm={send}
      />
    </div>
  );
}

function History({ ws }: { ws: string }) {
  const t = useTranslations("outage");
  const errorMessage = useErrorMessage();
  const campaigns = useCampaigns(ws);
  return (
    <Card>
      <CardHeader title={t("historyTitle")} />
      <CardBody>
        {campaigns.isPending ? (
          <Skeleton className="h-16" />
        ) : campaigns.isError ? (
          <p className="text-sm text-danger">{errorMessage(campaigns.error)}</p>
        ) : campaigns.data.length === 0 ? (
          <EmptyState icon={<Users />} title={t("historyEmpty")} />
        ) : (
          <ul className="divide-y">
            {campaigns.data.map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function CampaignRow({ campaign: c }: { campaign: OutageCampaign }) {
  const t = useTranslations("outage");
  const done = c.sent + c.failed;
  return (
    <li className="space-y-1.5 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={tones[c.status as keyof typeof tones] ?? "neutral"}>{t.has(`statuses.${c.status}`) ? t(`statuses.${c.status}` as "statuses.sending") : c.status}</Badge>
        <span className="tabular-nums">{t("progress", { sent: formatNumber(c.sent), failed: formatNumber(c.failed), scanned: formatNumber(c.scanned) })}</span>
        <span className="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</span>
      </p>
      {c.status === "sending" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${c.scanned ? Math.min(100, (done / c.scanned) * 100) : 5}%` }} />
        </div>
      ) : null}
      {c.status === "limit_reached" ? <p className="text-xs text-[oklch(0.45_0.11_70)] dark:text-warning">{t("limitReached")}</p> : null}
      <p className="line-clamp-2 whitespace-pre-line text-muted-foreground" dir="auto">
        {c.text}
      </p>
    </li>
  );
}
