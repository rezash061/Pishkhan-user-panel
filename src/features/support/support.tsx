"use client";

import { Headset } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authPost } from "@/lib/api/client";
import type { SupportInfo } from "@/lib/auth/support";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";

const SupportContext = createContext<SupportInfo | null>(null);

export function SupportProvider({ session, children }: { session: SupportInfo | null; children: ReactNode }) {
  return <SupportContext.Provider value={session}>{children}</SupportContext.Provider>;
}

/** The running support session, or null. Screens the backend refuses under support (password, 2FA, sessions, billing) hide on it. */
export function useSupportSession(): SupportInfo | null {
  return useContext(SupportContext);
}

export async function endSupportSession(reason: "ended" | "expired" = "ended") {
  await authPost("support-end").catch(() => undefined);
  window.location.assign(`/support-ended?reason=${reason}`);
}

function useRemaining(expiresAt: string | undefined): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return left;
}

/**
 * Red bar for the whole support session: who is in, how long is left, and a button to end it. The workspace shell
 * renders it above its own banners; elsewhere (workspace list, account) the root layout does.
 */
export function SupportBanner({ inShell }: { inShell?: boolean }) {
  const t = useTranslations("support");
  const session = useSupportSession();
  const pathname = usePathname();
  const left = useRemaining(session?.expiresAt);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (left === 0) void endSupportSession("expired");
  }, [left]);

  if (!session || (!inShell && pathname.startsWith("/w/"))) return null;
  const clock = left === null ? "" : toPersianDigits(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);

  return (
    <div role="region" aria-label={t("region")} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 bg-danger px-4 py-2 text-sm text-white", !inShell && "sticky top-0 z-40")}>
      <Headset className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 font-medium">{t("banner", { staff: session.staffUsername })}</span>
      {clock ? (
        <span className="tabular-nums" dir="ltr" aria-label={t("remaining", { time: clock })}>
          {clock}
        </span>
      ) : null}
      <button
        type="button"
        disabled={ending}
        onClick={() => {
          setEnding(true);
          void endSupportSession();
        }}
        className="rounded-lg border border-white/70 px-3 py-1 text-xs font-medium hover:bg-white/15 disabled:opacity-60"
      >
        {t("end")}
      </button>
    </div>
  );
}
