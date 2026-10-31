"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { BusinessHours } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDate } from "@/lib/i18n/format";
import { currentJalaliYear, jalaliDaysInMonth, jalaliMonths, jalaliToIso, nowruzDates } from "@/lib/i18n/jalali";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";

/** Iranian week: Saturday first. Values are .NET DayOfWeek (0 = Sunday). */
export const weekOrder = [6, 0, 1, 2, 3, 4, 5];

type Range = { from: string; to: string };
type Week = Record<number, Range[]>;

const hhmm = (time: string) => time.slice(0, 5);

function toWeek(hours: BusinessHours): Week {
  const week: Week = {};
  for (const day of weekOrder) week[day] = [];
  for (const d of hours.days) week[Number(d.day)] = d.ranges.map((r) => ({ from: hhmm(r.from), to: hhmm(r.to) }));
  return week;
}

/** The workspace's business hours: the inbox, automations and flows all read this one set. */
export function useBusinessHours(ws: string) {
  return useQuery({
    queryKey: qk.businessHours(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/business-hours", { params: { path: { workspaceId: ws } } })),
  });
}

export function BusinessHoursSettings() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const hours = useBusinessHours(workspace.id);
  if (hours.isPending) return <Skeleton className="h-96" />;
  if (hours.isError) return <p className="text-sm text-danger">{errorMessage(hours.error)}</p>;
  return <BusinessHoursEditor initial={hours.data} />;
}

function BusinessHoursEditor({ initial }: { initial: BusinessHours }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { workspace, can } = useWorkspace();
  const writable = can(P.settingsWrite);
  const ws = workspace.id;
  const [week, setWeek] = useState<Week>(() => toWeek(initial));
  const [closed, setClosed] = useState<string[]>(() => [...initial.closedDates].sort());

  const save = useMutation({
    mutationFn: async () => {
      const body: BusinessHours = {
        days: weekOrder
          .filter((day) => (week[day]?.length ?? 0) > 0)
          .map((day) => ({ day, ranges: week[day]!.map((r) => ({ from: `${r.from}:00`, to: `${r.to}:00` })) })),
        closedDates: closed,
      };
      return unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/business-hours", { params: { path: { workspaceId: ws } }, body }));
    },
    onSuccess: (data) => {
      qc.setQueryData(qk.businessHours(ws), data);
      toast.success(t("common.saved"));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const update = (day: number, ranges: Range[]) => setWeek({ ...week, [day]: ranges });

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-1">
          <p className="mb-3 text-sm text-muted-foreground">{t("settings.hours.subtitle")}</p>
          {weekOrder.map((day) => {
            const ranges = week[day] ?? [];
            const label = t(`settings.hours.days.${day}` as "settings.hours.days.0");
            return (
              <div key={day} className="flex flex-wrap items-start gap-3 border-b py-3 last:border-0">
                <div className="flex w-36 items-center gap-3 pt-1.5">
                  <Switch label={label} checked={ranges.length > 0} disabled={!writable} onChange={(on) => update(day, on ? [{ from: "09:00", to: "21:00" }] : [])} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {ranges.length === 0 ? <p className="pt-1.5 text-sm text-muted-foreground">{t("settings.hours.closed")}</p> : null}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" dir="ltr" aria-label={`${label} ${t("settings.hours.from")}`} className="h-9 w-28" disabled={!writable} value={r.from} onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                      <span className="text-sm text-muted-foreground">{t("settings.hours.to")}</span>
                      <Input type="time" dir="ltr" aria-label={`${label} ${t("settings.hours.to")}`} className="h-9 w-28" disabled={!writable} value={r.to} onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                      {writable && ranges.length > 1 ? (
                        <Button variant="ghost" size="icon-sm" aria-label={t("common.delete")} onClick={() => update(day, ranges.filter((_, j) => j !== i))}>
                          <X />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {writable && ranges.length > 0 && ranges.length < 4 ? (
                    <Button variant="link" size="sm" className="h-auto px-0" onClick={() => update(day, [...ranges, { from: "17:00", to: "21:00" }])}>
                      <Plus aria-hidden />
                      {t("settings.hours.addRange")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div>
            <h2 className="font-semibold">{t("settings.hours.closedDates")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.hours.closedDatesHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {closed.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 ps-3 pe-1 text-sm">
                {formatDate(`${d}T12:00:00Z`)}
                {writable ? (
                  <button type="button" aria-label={t("common.delete")} className="grid size-6 place-items-center rounded-full hover:bg-border" onClick={() => setClosed(closed.filter((x) => x !== d))}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          {writable ? <ClosedDatePicker onAdd={(iso) => setClosed([...new Set([...closed, ...iso])].sort())} /> : null}
        </CardBody>
      </Card>

      {writable ? (
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          {t("common.save")}
        </Button>
      ) : null}
    </div>
  );
}

/** Jalali day/month/year selects (no foreign date-picker dependency), plus a Nowruz preset. */
function ClosedDatePicker({ onAdd }: { onAdd: (dates: string[]) => void }) {
  const t = useTranslations("settings.hours");
  const thisYear = currentJalaliYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const days = jalaliDaysInMonth(year, month);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={t("day")} className="h-9 w-20" value={day} onChange={(e) => setDay(Number(e.target.value))}>
        {Array.from({ length: days }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {toPersianDigits(i + 1)}
          </option>
        ))}
      </Select>
      <Select aria-label={t("month")} className="h-9 w-32" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
        {jalaliMonths.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </Select>
      <Select aria-label={t("year")} className="h-9 w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {[thisYear, thisYear + 1].map((y) => (
          <option key={y} value={y}>
            {toPersianDigits(y)}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="secondary" onClick={() => onAdd([jalaliToIso(year, month, Math.min(day, days))])}>
        <Plus aria-hidden />
        {t("addDate")}
      </Button>
      <Button size="sm" variant="outline" onClick={() => onAdd(nowruzDates(thisYear + 1))}>
        {t("addPreset", { year: toPersianDigits(thisYear + 1) })}
      </Button>
    </div>
  );
}
