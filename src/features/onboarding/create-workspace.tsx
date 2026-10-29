"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { industries, type Industry } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { Stepper } from "./stepper";

export function CreateWorkspaceForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<Industry>("clothing");

  const create = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/workspaces", { body: { name: name.trim(), slug: null, industry } })),
    onSuccess: (workspace) => {
      document.cookie = `pk-ws=${workspace.id}; path=/; max-age=31536000; samesite=lax`;
      window.location.assign(`/onboarding/connect?ws=${workspace.id}`);
    },
  });

  const nameError = create.error instanceof ApiError ? codeMessage(create.error.field("name")) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Stepper step={1} />
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("onboarding.workspace.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("onboarding.workspace.subtitle")}</p>
      </div>
      {create.error && !nameError ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(create.error)}
        </p>
      ) : null}
      <Field label={t("onboarding.workspace.name")} htmlFor="name" error={nameError}>
        <Input id="name" required maxLength={100} autoFocus placeholder={t("onboarding.workspace.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">{t("onboarding.workspace.industry")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {industries.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                industry === value ? "border-primary bg-primary-soft font-medium text-primary" : "hover:bg-surface-muted",
              )}
            >
              <input type="radio" name="industry" value={value} className="sr-only" checked={industry === value} onChange={() => setIndustry(value)} />
              {t(`industries.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" size="lg" className="w-full" loading={create.isPending} disabled={!name.trim()}>
        {t("onboarding.workspace.create")}
      </Button>
    </form>
  );
}
