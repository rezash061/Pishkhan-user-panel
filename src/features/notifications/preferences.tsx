"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { NotificationPreference } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { useNotificationPreferences, useSaveNotificationPreferences } from "./data";

/** Each member's own choice, per kind: in the panel, as a push (not available yet) or by SMS (urgent kinds only). */
export function NotificationPreferences() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const prefs = useNotificationPreferences(workspace.id);
  if (prefs.isPending) return <Skeleton className="h-64" />;
  if (prefs.isError) return <p className="text-sm text-danger">{errorMessage(prefs.error)}</p>;
  return <PreferencesForm initial={prefs.data} />;
}

type Channel = "inApp" | "push" | "sms";

function PreferencesForm({ initial }: { initial: NotificationPreference[] }) {
  const t = useTranslations("notifications.prefs");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const save = useSaveNotificationPreferences(workspace.id);
  const [items, setItems] = useState(initial);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  const set = (kind: string, channel: Channel, on: boolean) => setItems((list) => list.map((p) => (p.kind === kind ? { ...p, [channel]: on } : p)));
  const label = (p: NotificationPreference) => (t.has(`kinds.${p.kind}`) ? t(`kinds.${p.kind}` as "kinds.handoff") : p.label);

  return (
    <Card>
      <CardHeader title={t("title")} description={t("subtitle", { workspace: workspace.name })} />
      <CardBody className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 text-start font-medium">{t("kind")}</th>
                <th className="w-20 py-2 font-medium">{t("inApp")}</th>
                <th className="w-20 py-2 font-medium">
                  {t("push")} <Badge className="ms-0.5">{t("soon")}</Badge>
                </th>
                <th className="w-20 py-2 font-medium">{t("sms")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((p) => (
                <tr key={p.kind}>
                  <th scope="row" className="py-3 text-start font-medium">
                    {label(p)}
                    {t.has(`hints.${p.kind}`) ? <span className="block text-xs font-normal text-muted-foreground">{t(`hints.${p.kind}` as "hints.handoff")}</span> : null}
                  </th>
                  <td className="py-3 text-center">
                    <Switch label={`${label(p)}: ${t("inApp")}`} checked={p.inApp} onChange={(on) => set(p.kind, "inApp", on)} />
                  </td>
                  <td className="py-3 text-center">
                    <Switch label={`${label(p)}: ${t("push")}`} checked={p.push} disabled onChange={(on) => set(p.kind, "push", on)} />
                  </td>
                  <td className="py-3 text-center">
                    {p.smsAvailable ? <Switch label={`${label(p)}: ${t("sms")}`} checked={p.sms} onChange={(on) => set(p.kind, "sms", on)} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{t("smsHint")}</p>
        <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(items, { onSuccess: () => toast.success(t("saved")), onError: (e) => toast.error(errorMessage(e)) })}>
          {t("save")}
        </Button>
      </CardBody>
    </Card>
  );
}
