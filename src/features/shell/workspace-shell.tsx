"use client";

import { ChevronsUpDown, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { LogoutButton } from "@/features/auth/logout-button";
import { RealtimeSync } from "@/features/inbox/realtime-sync";
import { NotificationBell } from "@/features/notifications/bell";
import { SupportBanner } from "@/features/support/support";
import { WorkspaceProvider, useWorkspace } from "@/features/workspace/context";
import type { Me, Workspace } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { HubProvider } from "@/lib/realtime/hub";
import { Banners } from "./banners";
import { moreIcon as MoreIcon, navItems, type NavItem } from "./nav";

// Browser-only (install events, user agent, localStorage), so it is not server rendered.
const InstallPrompt = dynamic(() => import("./install-prompt").then((m) => m.InstallPrompt), { ssr: false });

export function WorkspaceShell({ workspace, me, children }: { workspace: Workspace; me: Me; children: ReactNode }) {
  useEffect(() => {
    document.cookie = `pk-ws=${workspace.id}; path=/; max-age=31536000; samesite=lax`;
  }, [workspace.id]);

  return (
    <WorkspaceProvider workspace={workspace} me={me}>
      <HubProvider workspaceId={workspace.id}>
        <RealtimeSync workspaceId={workspace.id} />
        <Frame>{children}</Frame>
      </HubProvider>
    </WorkspaceProvider>
  );
}

function useNav() {
  const { workspace, can } = useWorkspace();
  const pathname = usePathname();
  const base = `/w/${workspace.id}`;
  const items = navItems.filter((item) => !item.permission || can(item.permission));
  const isActive = (item: NavItem) => (item.href === "" ? pathname === base : pathname.startsWith(base + item.href));
  return { items, base, isActive };
}

function Frame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { workspace, me } = useWorkspace();
  const { items, base, isActive } = useNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  const tabs = items.filter((i) => i.tab);
  const rest = items.filter((i) => !i.tab);
  // The inbox thread is full screen on phones: no bottom bar under the composer.
  const inThread = /\/inbox\/[^/]+/.test(pathname);

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">
        {t("nav.skipToContent")}
      </a>

      {/* Desktop sidebar (start side, which is the right in RTL). */}
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-surface lg:flex">
        <div className="flex items-center gap-2 p-4">
          <Logo />
          <span className="font-bold">{t("app.name")}</span>
        </div>
        <Link href="/workspaces?all=1" className="mx-3 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-surface-muted" title={t("workspaces.switch")}>
          <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
          <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
        </Link>
        <nav aria-label={t("nav.dashboard")} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin">
          {items.map((item) => (
            <NavLink key={item.key} item={item} base={base} active={isActive(item)} />
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t p-3">
          <Link href={`/account?ws=${workspace.id}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-muted">
            <UserRound className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{me.displayName || t("nav.account")}</span>
          </Link>
          <NotificationBell />
          <LogoutButton compact />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar. */}
        <header className={cn("flex h-14 shrink-0 items-center gap-2 border-b bg-surface px-4 lg:hidden", inThread && "hidden")}>
          <Logo className="size-7" />
          <Link href="/workspaces?all=1" className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold">
            <span className="truncate">{workspace.name}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <NotificationBell />
          <Link href={`/account?ws=${workspace.id}`} aria-label={t("nav.account")} className="grid size-9 place-items-center rounded-full hover:bg-surface-muted">
            <UserRound className="size-5" aria-hidden />
          </Link>
        </header>

        <SupportBanner inShell />
        <Banners />

        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>

        <InstallPrompt />

        {/* Mobile bottom tabs. */}
        <nav aria-label={t("nav.dashboard")} className={cn("grid shrink-0 border-t bg-surface safe-bottom lg:hidden", inThread && "hidden")} style={{ gridTemplateColumns: `repeat(${tabs.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {tabs.map((item) => (
            <Link
              key={item.key}
              href={base + item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive(item) ? "text-primary" : "text-muted-foreground")}
            >
              <item.icon className="size-5" aria-hidden />
              {t(`nav.${item.key}`)}
            </Link>
          ))}
          {rest.length ? (
            <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
              <MoreIcon className="size-5" aria-hidden />
              {t("nav.more")}
            </button>
          ) : null}
        </nav>
      </div>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")} variant="sheet">
        <div className="space-y-0.5">
          {rest.map((item) => (
            <NavLink key={item.key} item={item} base={base} active={isActive(item)} onNavigate={() => setMoreOpen(false)} />
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function NavLink({ item, base, active, onNavigate }: { item: NavItem; base: string; active: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  return (
    <Link
      href={base + item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active ? "bg-primary-soft font-medium text-primary" : "text-foreground/80 hover:bg-surface-muted",
      )}
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden />
      <span className="flex-1">{t(`nav.${item.key}`)}</span>
      {item.soon ? <Badge>{t("common.comingSoon")}</Badge> : null}
    </Link>
  );
}
