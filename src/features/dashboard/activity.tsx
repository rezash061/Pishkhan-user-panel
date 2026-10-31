"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { DashboardDay } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/i18n/format";

export const ranges = ["today", "7d", "30d"] as const;
export type Range = (typeof ranges)[number];

export function useDashboard(ws: string, range: Range, enabled: boolean) {
  return useQuery({
    queryKey: qk.dashboard(ws, range),
    enabled,
    // Inbox and channel numbers are live; period counts lag a few minutes behind (hourly rollups).
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/dashboard", { params: { path: { workspaceId: ws }, query: { range } } })),
  });
}

/** Who answered, in a fixed order so a series keeps its colour whatever the numbers. */
export const series = [
  { key: "repliesByRule", color: "bg-series-1" },
  { key: "repliesByAi", color: "bg-series-2" },
  { key: "repliesByHuman", color: "bg-series-3" },
] as const;
type SeriesKey = (typeof series)[number]["key"];

/** Legend with totals (identity never by colour alone) and one 100% bar of who answered over the period. */
export function RepliesBreakdown({ totals }: { totals: Record<SeriesKey, number> }) {
  const t = useTranslations("dashboard.activity");
  const sum = series.reduce((n, s) => n + totals[s.key], 0);
  return (
    <div className="space-y-2">
      {sum ? (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden dir="ltr">
          {series.map((s) => (totals[s.key] ? <div key={s.key} className={cn("h-full first:rounded-s-full last:rounded-e-full", s.color)} style={{ width: `${(totals[s.key] / sum) * 100}%` }} /> : null))}
        </div>
      ) : null}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", s.color)} aria-hidden />
            <span className="text-muted-foreground">{t(s.key)}</span>
            <span className="font-medium tabular-nums">{formatNumber(totals[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Replies per day, stacked by who answered: thin bars with 2px gaps between segments, a hover tooltip per day, and a
 * table for screen readers.
 */
export function DailyReplies({ days }: { days: DashboardDay[] }) {
  const t = useTranslations("dashboard.activity");
  const total = (d: DashboardDay) => d.repliesByRule + d.repliesByAi + d.repliesByHuman;
  const max = Math.max(1, ...days.map(total));
  const label = (day: string) => formatDate(`${day}T12:00:00Z`);
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-muted-foreground">{t("perDay")}</figcaption>
      <div className="flex h-32 items-end gap-1 border-b" aria-hidden dir="ltr">
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex w-full flex-col-reverse gap-[2px]" style={{ height: `${(total(d) / max) * 100}%` }}>
              {series.map((s) =>
                d[s.key] ? <div key={s.key} className={cn("w-full last:rounded-t-[4px]", s.color)} style={{ flexGrow: d[s.key], flexBasis: 0, minHeight: 2 }} /> : null,
              )}
            </div>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] leading-5 text-background group-hover:block" dir="rtl">
              <span className="block font-medium">{label(d.day)}</span>
              {series.map((s) => (
                <span key={s.key} className="block">
                  {t(s.key)}: {formatNumber(d[s.key])}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("perDay")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {t(s.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{label(d.day)}</th>
              {series.map((s) => (
                <td key={s.key}>{formatNumber(d[s.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
