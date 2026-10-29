"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { industries } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";

export function GeneralSettings() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const writable = can(P.settingsWrite);
  const [name, setName] = useState(workspace.name);
  const [industry, setIndustry] = useState(workspace.industry);

  const save = useMutation({
    mutationFn: async () =>
      unwrap(await api.PATCH("/api/v1/workspaces/{workspaceId}", { params: { path: { workspaceId: workspace.id } }, body: { name: name.trim(), industry } })),
    onSuccess: () => {
      toast.success(t("common.saved"));
      // The workspace comes from the server layout; refresh it so the shell shows the new name.
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) save.mutate();
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} className="max-w-md space-y-4">
          {!writable ? <p className="text-sm text-muted-foreground">{t("settings.readOnly")}</p> : null}
          <Field label={t("settings.name")} htmlFor="ws-name">
            <Input id="ws-name" maxLength={100} required disabled={!writable} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("settings.industry")} htmlFor="ws-industry">
            <Select id="ws-industry" disabled={!writable} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {t(`industries.${i}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("settings.slug")} htmlFor="ws-slug">
            <Input id="ws-slug" dir="ltr" disabled value={workspace.slug} readOnly />
          </Field>
          <Field label={t("settings.timeZone")} htmlFor="ws-tz">
            <Input id="ws-tz" dir="ltr" disabled value={workspace.timeZone} readOnly />
          </Field>
          {writable ? (
            <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
              {t("common.save")}
            </Button>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
