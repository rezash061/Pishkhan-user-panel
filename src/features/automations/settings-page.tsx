"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { AutomationSettings, BusinessHours } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useAutomationSettings, useSaveAutomationSettings } from "./data";

/** Automation's own hours use day keys (backend `BusinessHours.DayKeys`), Saturday first in the Iranian week. */
export const dayKeys = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
type DayKey = (typeof dayKeys)[number];
type Range = { from: string; to: string };
type Week = Record<DayKey, Range[]>;
/** .NET DayOfWeek (0 = Sunday) → automation day key. */
const dotnetDay: Record<number, DayKey> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };

export function toWeek(days: Record<string, string[]>): Week {
  const week = Object.fromEntries(dayKeys.map((d) => [d, [] as Range[]])) as Week;
  for (const d of dayKeys)
    week[d] = (days[d] ?? []).map((r) => {
      const [from = "", to = ""] = r.split("-").map((x) => x.trim());
      return { from, to };
    });
  return week;
}

export function fromWeek(week: Week): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of dayKeys) if (week[d].length) out[d] = week[d].map((r) => `${r.from}-${r.to}`);
  return out;
}

/** Workspace business hours (Settings) in the automation format, so sellers can keep both the same with one click. */
export function weekFromWorkspaceHours(hours: BusinessHours): Week {
  const week = toWeek({});
  for (const d of hours.days) week[dotnetDay[Number(d.day)]!] = d.ranges.map((r) => ({ from: r.from.slice(0, 5), to: r.to.slice(0, 5) }));
  return week;
}

export function AutomationSettingsPage() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const settings = useAutomationSettings(workspace.id);
  if (settings.isPending) return <Skeleton className="h-96" />;
  if (settings.isError) return <p className="text-sm text-danger">{errorMessage(settings.error)}</p>;
  return <SettingsForm initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: AutomationSettings }) {
  const t = useTranslations("automations.settings");
  const td = useTranslations("settings.hours");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.automationWrite);
  const save = useSaveAutomationSettings(ws);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [fallbackText, setFallbackText] = useState(initial.fallbackText ?? "");
  const [cooldown, setCooldown] = useState(Number(initial.fallbackCooldownMinutes));
  const [week, setWeek] = useState<Week>(() => toWeek(initial.businessHours.days));
  const configured = dayKeys.some((d) => week[d].length > 0);
  const labels: Record<DayKey, string> = { sat: td("days.6"), sun: td("days.0"), mon: td("days.1"), tue: td("days.2"), wed: td("days.3"), thu: td("days.4"), fri: td("days.5") };

  const copyFromWorkspace = async () => {
    try {
      const hours = await qc.fetchQuery({
        queryKey: qk.businessHours(ws),
        queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/business-hours", { params: { path: { workspaceId: ws } } })),
      });
      setWeek(weekFromWorkspaceHours(hours));
      toast.success(t("copied"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = () =>
    save.mutate(
      {
        aiEnabled,
        fallbackText: fallbackText.trim() || null,
        fallbackCooldownMinutes: cooldown,
        businessHours: { timeZone: initial.businessHours.timeZone || "Asia/Tehran", days: fromWeek(week) },
      },
      { onSuccess: () => toast.success(t("saved")), onError: (e) => toast.error(errorMessage(e)) },
    );

  const update = (day: DayKey, ranges: Range[]) => setWeek({ ...week, [day]: ranges });
  const invalid = dayKeys.some((d) => week[d].some((r) => !r.from || !r.to || r.from >= r.to));

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex items-start gap-4">
          <Switch id="ai-enabled" label={t("ai")} checked={aiEnabled} disabled={!writable} onChange={setAiEnabled} />
          <label htmlFor="ai-enabled" className="min-w-0 space-y-1">
            <span className="block font-medium">{t("ai")}</span>
            <span className="block text-sm text-muted-foreground">{aiEnabled ? t("aiOn") : t("aiOff")}</span>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("hours")}
          description={t("hoursHint")}
          action={
            writable ? (
              <Button variant="outline" size="sm" onClick={() => void copyFromWorkspace()}>
                <Copy aria-hidden />
                {t("copyFromSettings")}
              </Button>
            ) : null
          }
        />
        <CardBody className="space-y-1">
          {!configured ? <p className="mb-2 rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("alwaysOpen")}</p> : null}
          {dayKeys.map((day) => {
            const ranges = week[day];
            return (
              <div key={day} className="flex flex-wrap items-start gap-3 border-b py-3 last:border-0">
                <div className="flex w-36 items-center gap-3 pt-1.5">
                  <Switch label={labels[day]} checked={ranges.length > 0} disabled={!writable} onChange={(on) => update(day, on ? [{ from: "09:00", to: "21:00" }] : [])} />
                  <span className="text-sm font-medium">{labels[day]}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {ranges.length === 0 ? <p className="pt-1.5 text-sm text-muted-foreground">{configured ? td("closed") : t("noHours")}</p> : null}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" dir="ltr" aria-label={`${labels[day]} ${td("from")}`} className="h-9 w-28" disabled={!writable} value={r.from} onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                      <span className="text-sm text-muted-foreground">{td("to")}</span>
                      <Input type="time" dir="ltr" aria-label={`${labels[day]} ${td("to")}`} className="h-9 w-28" disabled={!writable} value={r.to} onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                      {writable && ranges.length > 1 ? (
                        <Button variant="ghost" size="icon-sm" aria-label={td("closed")} onClick={() => update(day, ranges.filter((_, j) => j !== i))}>
                          <X />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {writable && ranges.length > 0 && ranges.length < 4 ? (
                    <Button variant="link" size="sm" className="h-auto px-0" onClick={() => update(day, [...ranges, { from: "17:00", to: "21:00" }])}>
                      <Plus aria-hidden />
                      {td("addRange")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("fallback")} description={t("fallbackHint")} />
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label={t("fallbackText")} htmlFor="fallback-text">
            <Textarea id="fallback-text" dir="auto" maxLength={1000} disabled={!writable} value={fallbackText} placeholder={t("fallbackPlaceholder")} onChange={(e) => setFallbackText(e.target.value)} />
          </Field>
          <Field label={t("cooldown")} htmlFor="fallback-cooldown" hint={t("cooldownHint")}>
            <Input id="fallback-cooldown" type="number" dir="ltr" min={0} max={43200} disabled={!writable} value={cooldown} onChange={(e) => setCooldown(Math.max(0, Math.min(43200, Number(e.target.value) || 0)))} />
          </Field>
        </CardBody>
      </Card>

      {writable ? (
        <Button onClick={submit} loading={save.isPending} disabled={invalid}>
          {t("save")}
        </Button>
      ) : null}
    </div>
  );
}
