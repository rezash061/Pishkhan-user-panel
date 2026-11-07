"use client";

import { CloudOff, Megaphone, PlugZap, TriangleAlert, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useChannels } from "@/features/channels/data";
import { useOutageStatus } from "@/features/outage/data";
import { useAnnouncements } from "@/features/tickets/data";
import { isDown } from "@/features/outage/model";
import { P } from "@/lib/permissions";
import { useWorkspace } from "@/features/workspace/context";
import { cn } from "@/lib/cn";
import { useHubStatus } from "@/lib/realtime/hub";
import type { Announcement } from "@/lib/api/types";

const DISMISSED_KEY = "pishkhan.announcements.dismissed";

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Platform notices from Pishkhan (AD-2.6). Info and warning notices can be hidden on this device; critical ones stay. */
function AnnouncementBanners({ items, base }: { items: Announcement[]; base: string }) {
  const t = useTranslations("banners");
  // Read lazily: notices arrive from a query after hydration, so the server render never shows any.
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: hidden for this visit only.
    }
  };
  return (
    <>
      {items
        .filter((a) => a.severity === "critical" || !dismissed.includes(a.id))
        .map((a) => {
          const link = a.link ? (a.link.startsWith("/") ? `${base}${a.link}` : a.link) : null;
          return (
            <Banner
              key={a.id}
              tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "neutral"}
              icon={<Megaphone />}
              action={
                <span className="flex shrink-0 items-center gap-2">
                  {link ? (
                    link.startsWith("/") ? (
                      <Link href={link} className="font-semibold underline-offset-4 hover:underline">
                        {t("announcementMore")}
                      </Link>
                    ) : (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">
                        {t("announcementMore")}
                      </a>
                    )
                  ) : null}
                  {a.severity !== "critical" ? (
                    <button type="button" onClick={() => dismiss(a.id)} aria-label={t("announcementDismiss")} className="grid size-6 place-items-center rounded-md hover:bg-black/5">
                      <X />
                    </button>
                  ) : null}
                </span>
              }
            >
              <span data-testid="announcement">
                <span className="font-semibold">{a.title}</span>
                {a.body ? <span> {a.body}</span> : null}
              </span>
            </Banner>
          );
        })}
    </>
  );
}

function Banner({ tone, icon, children, action }: { tone: "danger" | "warning" | "neutral"; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "danger" && "bg-danger-soft text-[oklch(0.45_0.17_25)] dark:text-danger",
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
  const { workspace, can } = useWorkspace();
  const channels = useChannels(workspace.id);
  const outage = useOutageStatus(workspace.id, can(P.inboxRead));
  const announcements = useAnnouncements(workspace.id, can(P.settingsRead));
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
  const onOutage = pathname.startsWith(`${base}/settings/outage`);

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
      <AnnouncementBanners items={announcements.data ?? []} base={base} />
      {isDown(outage.data?.status) ? (
        <Banner
          tone="danger"
          icon={<CloudOff />}
          action={
            can(P.crmRead) && !onOutage ? (
              <Link href={`${base}/settings/outage`} className="shrink-0 font-semibold underline-offset-4 hover:underline">
                {t("outageAction")}
              </Link>
            ) : null
          }
        >
          <span className="font-semibold">{t("outage")}</span> {t("outageBody")}
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
