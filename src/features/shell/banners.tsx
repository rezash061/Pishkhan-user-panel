"use client";

import { CloudOff, PlugZap, TriangleAlert, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { cn } from "@/lib/cn";
import { useHubStatus } from "@/lib/realtime/hub";

function Banner({ tone, icon, children, action }: { tone: "danger" | "warning" | "neutral"; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "warning" && "bg-warning-soft text-[oklch(0.45_0.11_70)] dark:text-warning",
        tone === "neutral" && "bg-surface-muted text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Never silent (plan principle 4): disconnected Instagram, expiring tokens, no channel, offline, realtime down. */
export function Banners() {
  const t = useTranslations("banners");
  const { workspace } = useWorkspace();
  const channels = useChannels(workspace.id);
  const hub = useHubStatus();
  const online = useOnline();
  const pathname = usePathname();
  const base = `/w/${workspace.id}`;
  const [hubDownLong, setHubDownLong] = useState(false);

  // Only complain about realtime after it has been down for a while; short reconnects are normal on mobile networks.
  useEffect(() => {
    if (hub === "connected") return;
    const timer = setTimeout(() => setHubDownLong(true), 8_000);
    return () => {
      clearTimeout(timer);
      setHubDownLong(false);
    };
  }, [hub]);

  const reconnectLink = (
    <Link href={`${base}/channels`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
      {t("reconnect")}
    </Link>
  );

  const list = channels.data ?? [];
  const broken = list.filter((c) => c.status === "reauth_required");
  const expiring = list.filter((c) => c.status === "token_expiring");
  const onChannels = pathname.startsWith(`${base}/channels`);

  return (
    <div className="shrink-0">
      {!online ? (
        <Banner tone="neutral" icon={<WifiOff />}>
          {t("offline")}
        </Banner>
      ) : hubDownLong ? (
        <Banner tone="neutral" icon={<CloudOff />}>
          {t("realtimeDown")}
        </Banner>
      ) : null}
      {broken.map((c) => (
        <Banner key={c.id} tone="danger" icon={<TriangleAlert />} action={onChannels ? null : reconnectLink}>
          {t("reauth", { username: c.username ?? c.externalId })}
        </Banner>
      ))}
      {expiring.map((c) => (
        <Banner key={c.id} tone="warning" icon={<TriangleAlert />} action={onChannels ? null : reconnectLink}>
          {t("tokenExpiring", { username: c.username ?? c.externalId })}
        </Banner>
      ))}
      {channels.isSuccess && list.length === 0 && !onChannels ? (
        <Banner
          tone="warning"
          icon={<PlugZap />}
          action={
            <Link href={`${base}/channels`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
              {t("connect")}
            </Link>
          }
        >
          {t("noChannel")}
        </Banner>
      ) : null}
    </div>
  );
}
