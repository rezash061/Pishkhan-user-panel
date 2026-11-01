"use client";

import { BellRing, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { describeAgent, PushPermissionDenied, pushSupport, useCurrentPush, useEnablePush, usePushKey, usePushSubscriptions, useRemovePush, type PushSupport } from "./push";

const noop = () => () => undefined;

/** Browser-only facts, read after hydration so the server render and the first client render agree. */
function useBrowser(): { support: PushSupport; permission: NotificationPermission | null } | null {
  const support = useSyncExternalStore(noop, () => pushSupport(), () => null);
  const permission = useSyncExternalStore(noop, () => ("Notification" in window ? Notification.permission : null), () => null);
  return support === null ? null : { support, permission };
}

/**
 * «اعلان روی این دستگاه»: turn push on for this browser and manage the other browsers that get it.
 * Push is per user and per browser; which kinds are pushed is chosen per workspace in the table below.
 */
export function PushCard() {
  const t = useTranslations("notifications.push");
  const errorMessage = useErrorMessage();
  const browser = useBrowser();
  const key = usePushKey();
  const available = Boolean(key.data);
  const supported = browser?.support === "supported";
  const current = useCurrentPush(available && supported);
  const list = usePushSubscriptions(available);
  const enable = useEnablePush();
  const remove = useRemovePush();

  if (key.isPending || !browser) return <Skeleton className="h-28" />;
  // Not configured on the server: nothing to offer.
  if (!available) return null;

  const on = Boolean(current.data && list.data?.some((s) => s.endpoint === current.data));
  const others = (list.data ?? []).filter((s) => s.endpoint !== current.data);

  const turnOn = () =>
    enable.mutate(key.data!, {
      onSuccess: () => toast.success(t("enabled")),
      onError: (err) => toast.error(err instanceof PushPermissionDenied ? t("denied") : errorMessage(err)),
    });

  return (
    <Card>
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <BellRing className="size-5 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            {browser.support === "ios-install" ? t("iosInstall") : !supported ? t("unsupported") : browser.permission === "denied" && !on ? t("blocked") : on ? t("onHere") : t("offHere")}
          </p>
          {supported && browser.permission !== "denied" ? (
            on ? (
              <Button
                variant="outline"
                loading={remove.isPending}
                onClick={() => remove.mutate({ endpoint: current.data!, local: true }, { onSuccess: () => toast.success(t("disabled")), onError: (err) => toast.error(errorMessage(err)) })}
              >
                {t("turnOff")}
              </Button>
            ) : (
              <Button loading={enable.isPending || current.isPending} onClick={turnOn}>
                {t("turnOn")}
              </Button>
            )
          ) : null}
        </div>
        {others.length > 0 ? (
          <section aria-labelledby="push-others" className="space-y-2">
            <h3 id="push-others" className="text-xs font-semibold text-muted-foreground">
              {t("others")}
            </h3>
            <ul className="divide-y rounded-xl border">
              {others.map((s) => {
                const agent = describeAgent(s.userAgent);
                const name = agent ? [agent.browser, agent.os].filter(Boolean).join(t("on")) : t("unknownBrowser");
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" dir="auto">
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("added", { when: formatRelative(s.createdAt) })}
                        {s.lastDeliveredAt ? ` · ${t("lastSent", { when: formatRelative(s.lastDeliveredAt) })}` : null}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("removeFor", { name })}
                      onClick={() => remove.mutate({ endpoint: s.endpoint, local: false }, { onSuccess: () => toast.success(t("removed")), onError: (err) => toast.error(errorMessage(err)) })}
                    >
                      {t("remove")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        {on ? <p className="text-xs text-muted-foreground">{t("chooseKinds")}</p> : null}
      </CardBody>
    </Card>
  );
}
