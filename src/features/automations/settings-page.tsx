"use client";

import { Clock, Pencil } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useBusinessHours, weekOrder } from "@/features/settings/business-hours";
import { useWorkspace } from "@/features/workspace/context";
import type { AutomationSettings } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useAutomationSettings, useSaveAutomationSettings } from "./data";

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
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.automationWrite);
  const save = useSaveAutomationSettings(workspace.id);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [fallbackText, setFallbackText] = useState(initial.fallbackText ?? "");
  const [cooldown, setCooldown] = useState(initial.fallbackCooldownMinutes ?? 0);

  const submit = () =>
    save.mutate(
      { aiEnabled, fallbackText: fallbackText.trim() || null, fallbackCooldownMinutes: cooldown },
      { onSuccess: () => toast.success(t("saved")), onError: (e) => toast.error(errorMessage(e)) },
    );

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

      <HoursSummary />

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
        <Button onClick={submit} loading={save.isPending}>
          {t("save")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Automations read the workspace's business hours (one set for the whole panel), so this only shows them and links to
 * the place they are edited.
 */
function HoursSummary() {
  const t = useTranslations("automations.settings");
  const td = useTranslations("settings.hours");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const hours = useBusinessHours(workspace.id);
  const hhmm = (time: string) => toPersianDigits(time.slice(0, 5));

  return (
    <Card>
      <CardHeader
        title={t("hours")}
        description={t("hoursHint")}
        action={
          can(P.settingsWrite) ? (
            <Link href={`/w/${workspace.id}/settings/business-hours`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil aria-hidden />
              {t("editHours")}
            </Link>
          ) : null
        }
      />
      <CardBody>
        {hours.isPending ? (
          <Skeleton className="h-40" />
        ) : hours.isError ? (
          <p className="text-sm text-danger">{errorMessage(hours.error)}</p>
        ) : (
          <>
            <dl className="divide-y text-sm">
              {weekOrder.map((day) => {
                const ranges = hours.data.days.find((d) => d.day === day)?.ranges ?? [];
                return (
                  <div key={day} className="flex items-center justify-between gap-3 py-2">
                    <dt className="font-medium">{td(`days.${day}` as "days.0")}</dt>
                    <dd className={ranges.length ? "tabular-nums" : "text-muted-foreground"}>
                      {ranges.length ? ranges.map((r) => `${td("from")} ${hhmm(r.from)} ${td("to")} ${hhmm(r.to)}`).join("، ") : td("closed")}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {hours.data.closedDates.length ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {t("closedDates", { n: toPersianDigits(hours.data.closedDates.length) })}
              </p>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
