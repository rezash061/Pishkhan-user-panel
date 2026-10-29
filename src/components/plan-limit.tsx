"use client";

import { Gem } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/errors";

const PlanLimitContext = createContext<(error: unknown) => void>(() => undefined);

let listener: ((error: unknown) => void) | null = null;

/** Called by the query client for every failed request; opens the sheet when it is a plan-limit problem. */
export function notifyPlanLimit(error: unknown) {
  listener?.(error);
}

/** Any `402 plan-limit` problem opens an upgrade sheet naming the limit from `detail` (overview section 6, plan 2.4). */
export function PlanLimitProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("planLimit");
  const [limit, setLimit] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string | null>(null);

  const handle = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || !error.isPlanLimit) return;
    setWorkspace(window.location.pathname.match(/^\/w\/([0-9a-f-]{36})/i)?.[1] ?? null);
    setLimit(error.detail ?? error.code);
  }, []);
  useEffect(() => {
    listener = handle;
    return () => {
      listener = null;
    };
  }, [handle]);

  const label = limit && t.has(`limits.${limit}`) ? t(`limits.${limit}` as "limits.default") : (limit ?? "");

  return (
    <PlanLimitContext.Provider value={handle}>
      {children}
      <Dialog
        open={limit !== null}
        onClose={() => setLimit(null)}
        variant="sheet"
        title={
          <span className="inline-flex items-center gap-2">
            <Gem className="size-4 text-primary" aria-hidden />
            {t("title")}
          </span>
        }
        description={t("body", { limit: label })}
        footer={
          workspace ? (
            <Link href={`/w/${workspace}/billing`} onClick={() => setLimit(null)} className={buttonVariants()}>
              {t("upgrade")}
            </Link>
          ) : null
        }
      />
    </PlanLimitContext.Provider>
  );
}

export function usePlanLimit() {
  return useContext(PlanLimitContext);
}
