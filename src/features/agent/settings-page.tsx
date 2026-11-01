"use client";

import { Bot } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChipsInput } from "@/components/ui/chips-input";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { StickyActions } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useAutomationSettings, useSaveAutomationSettings } from "@/features/automations/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { AgentProfile, AgentProfileResponse } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { agentLimits, tones, useAgentProfile, useSaveAgentProfile } from "./data";

export function AgentSettingsPage() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const profile = useAgentProfile(workspace.id);
  return (
    <div className="space-y-5">
      <AiSwitch />
      {profile.isPending ? <Skeleton className="h-96" /> : profile.isError ? <p className="text-sm text-danger">{errorMessage(profile.error)}</p> : <ProfileForm key={profile.data.updatedAt ?? "default"} initial={profile.data} />}
    </div>
  );
}

/** AI on/off lives in the automation settings (the rules run first, the AI answers the rest); it is mirrored here. */
function AiSwitch() {
  const t = useTranslations("agent.ai");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const settings = useAutomationSettings(workspace.id);
  const save = useSaveAutomationSettings(workspace.id);
  if (settings.isPending) return <Skeleton className="h-20" />;
  if (settings.isError) return null;
  const on = settings.data.aiEnabled;
  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <Switch
          id="agent-ai"
          label={t("label")}
          checked={on}
          disabled={!can(P.automationWrite) || save.isPending}
          onChange={(aiEnabled) => save.mutate({ ...settings.data, aiEnabled }, { onSuccess: () => toast.success(t(aiEnabled ? "turnedOn" : "turnedOff")), onError: (e) => toast.error(errorMessage(e)) })}
        />
        <label htmlFor="agent-ai" className="min-w-0 space-y-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Bot className="size-4 text-primary" aria-hidden />
            {t("label")}
          </span>
          <span className="block text-sm text-muted-foreground">{on ? t("on") : t("off")}</span>
        </label>
      </CardBody>
    </Card>
  );
}

type Errors = Partial<Record<string, string>>;

function ProfileForm({ initial }: { initial: AgentProfileResponse }) {
  const t = useTranslations("agent.settings");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.agentWrite);
  const save = useSaveAgentProfile(workspace.id);
  const [p, setP] = useState<AgentProfile>(initial.profile);
  const [sendHandoffMessage, setSendHandoffMessage] = useState(initial.profile.handoffMessage !== null);
  const [handoffMessage, setHandoffMessage] = useState(initial.profile.handoffMessage ?? t("defaultHandoffMessage"));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof AgentProfile>(key: K, value: AgentProfile[K]) => setP((x) => ({ ...x, [key]: value }));
  const setRule = <K extends keyof AgentProfile["handoff"]>(key: K, value: AgentProfile["handoff"][K]) => setP((x) => ({ ...x, handoff: { ...x.handoff, [key]: value } }));
  const ids = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const body: AgentProfile = {
      ...p,
      name: p.name.trim(),
      brandVoice: p.brandVoice?.trim() || null,
      handoffMessage: sendHandoffMessage ? handoffMessage.trim() || null : null,
    };
    save.mutate(body, {
      onSuccess: () => toast.success(t("saved")),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 400) {
          const next: Errors = {};
          for (const f of ["name", "tone", "brandVoice", "confidenceThreshold", "handoffMessage", "neverSay", "handoff.keywords", "handoff.vipTags", "allowedDomains"]) {
            const code = err.field(f);
            if (code) next[f] = codeMessage(code) ?? t("invalid");
          }
          if (Object.keys(next).length) {
            setErrors(next);
            return toast.error(t("fixErrors"));
          }
        }
        toast.error(errorMessage(err));
      },
    });
  };

  const percent = (v: number) => toPersianDigits(Math.round(v * 100));

  return (
    <form onSubmit={submit} className="space-y-5">
      {initial.isDefault ? <p className="rounded-xl bg-primary-soft/60 p-3 text-sm">{t("defaults")}</p> : initial.updatedAt ? <p className="text-xs text-muted-foreground">{t("updated", { when: formatRelative(initial.updatedAt) })}</p> : null}

      <Card>
        <CardHeader title={t("persona")} description={t("personaHint")} />
        <CardBody className="space-y-4">
          <Field label={t("name")} htmlFor={`${ids}-name`} hint={t("nameHint")} error={errors.name}>
            <Input id={`${ids}-name`} dir="auto" maxLength={agentLimits.name} disabled={!writable} value={p.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium" id={`${ids}-tone`}>
              {t("tone")}
            </span>
            <Segmented label={t("tone")} value={p.tone as (typeof tones)[number]} disabled={!writable} onChange={(v) => set("tone", v)} options={tones.map((x) => ({ value: x, label: t(`tones.${x}`) }))} />
            <p className="text-xs text-muted-foreground">{t(`toneHints.${(tones as readonly string[]).includes(p.tone) ? (p.tone as (typeof tones)[number]) : "friendly"}`)}</p>
            {errors.tone ? <p className="text-xs text-danger">{errors.tone}</p> : null}
          </div>
          <Field label={t("brandVoice")} htmlFor={`${ids}-voice`} hint={t("brandVoiceHint")} error={errors.brandVoice}>
            <Textarea id={`${ids}-voice`} dir="auto" maxLength={agentLimits.brandVoice} className="min-h-24" disabled={!writable} placeholder={t("brandVoicePlaceholder")} value={p.brandVoice ?? ""} onChange={(e) => set("brandVoice", e.target.value)} />
          </Field>
          <Toggle id={`${ids}-lang`} label={t("customerLanguage")} hint={t("customerLanguageHint")} checked={p.replyInCustomerLanguage} disabled={!writable} onChange={(v) => set("replyInCustomerLanguage", v)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("safety")} description={t("safetyHint")} />
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <label htmlFor={`${ids}-threshold`} className="block text-sm font-medium">
              {t("threshold")}
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${ids}-threshold`}
                type="range"
                min={agentLimits.minThreshold}
                max={agentLimits.maxThreshold}
                step={0.05}
                disabled={!writable}
                value={p.confidenceThreshold}
                aria-valuetext={t("thresholdValue", { n: percent(p.confidenceThreshold) })}
                onChange={(e) => set("confidenceThreshold", Number(e.target.value))}
                className="h-2 flex-1 accent-[var(--color-primary)]"
              />
              <span className="w-14 text-end text-sm font-medium tabular-nums">{t("thresholdValue", { n: percent(p.confidenceThreshold) })}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("thresholdHint")}</p>
            {errors.confidenceThreshold ? <p className="text-xs text-danger">{errors.confidenceThreshold}</p> : null}
          </div>
          <Field label={t("neverSay")} htmlFor={`${ids}-never`} hint={t("neverSayHint")} error={errors.neverSay}>
            <ChipsInput id={`${ids}-never`} values={p.neverSay} onChange={(v) => set("neverSay", v)} max={agentLimits.phrases} maxLength={agentLimits.phrase} disabled={!writable} invalid={Boolean(errors.neverSay)} placeholder={t("neverSayPlaceholder")} />
          </Field>
          <Field label={t("domains")} htmlFor={`${ids}-domains`} hint={t("domainsHint")} error={errors.allowedDomains}>
            <ChipsInput
              id={`${ids}-domains`}
              values={p.allowedDomains}
              onChange={(v) => set("allowedDomains", v)}
              max={agentLimits.phrases}
              maxLength={253}
              disabled={!writable}
              invalid={Boolean(errors.allowedDomains)}
              placeholder="example.ir"
              validate={(v) => /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v.trim())}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("handoff")} description={t("handoffHint")} />
        <CardBody className="space-y-4">
          <Toggle id={`${ids}-human`} label={t("rules.humanRequest")} hint={t("rules.humanRequestHint")} checked={p.handoff.humanRequest} disabled={!writable} onChange={(v) => setRule("humanRequest", v)} />
          <Toggle id={`${ids}-complaint`} label={t("rules.complaint")} hint={t("rules.complaintHint")} checked={p.handoff.complaint} disabled={!writable} onChange={(v) => setRule("complaint", v)} />
          <Toggle id={`${ids}-discount`} label={t("rules.discountRequest")} hint={t("rules.discountRequestHint")} checked={p.handoff.discountRequest} disabled={!writable} onChange={(v) => setRule("discountRequest", v)} />
          <Toggle id={`${ids}-repeat`} label={t("rules.repeatedLowConfidence")} hint={t("rules.repeatedLowConfidenceHint")} checked={p.handoff.repeatedLowConfidence} disabled={!writable} onChange={(v) => setRule("repeatedLowConfidence", v)} />
          <Field label={t("rules.keywords")} htmlFor={`${ids}-keywords`} hint={t("rules.keywordsHint")} error={errors["handoff.keywords"]}>
            <ChipsInput id={`${ids}-keywords`} values={p.handoff.keywords} onChange={(v) => setRule("keywords", v)} max={agentLimits.phrases} maxLength={agentLimits.phrase} disabled={!writable} invalid={Boolean(errors["handoff.keywords"])} placeholder={t("rules.keywordsPlaceholder")} />
          </Field>
          <Field
            label={t("rules.vipTags")}
            htmlFor={`${ids}-vip`}
            hint={
              <>
                {t("rules.vipTagsHint")}{" "}
                {can(P.crmRead) ? (
                  <Link href={`/w/${workspace.id}/contacts/tags`} className="text-primary underline underline-offset-2">
                    {t("rules.manageTags")}
                  </Link>
                ) : null}
              </>
            }
            error={errors["handoff.vipTags"]}
          >
            <ChipsInput id={`${ids}-vip`} values={p.handoff.vipTags} onChange={(v) => setRule("vipTags", v)} max={agentLimits.phrases} maxLength={50} disabled={!writable} invalid={Boolean(errors["handoff.vipTags"])} />
          </Field>
          <div className="space-y-2 border-t pt-4">
            <Toggle id={`${ids}-send-msg`} label={t("sendHandoffMessage")} hint={t("sendHandoffMessageHint")} checked={sendHandoffMessage} disabled={!writable} onChange={setSendHandoffMessage} />
            {sendHandoffMessage ? (
              <Field label={t("handoffMessage")} htmlFor={`${ids}-msg`} error={errors.handoffMessage}>
                <Textarea id={`${ids}-msg`} dir="auto" maxLength={agentLimits.handoffMessage} disabled={!writable} value={handoffMessage} onChange={(e) => setHandoffMessage(e.target.value)} />
              </Field>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {writable ? (
        <StickyActions>
          <Button type="submit" loading={save.isPending} disabled={!p.name.trim()}>
            {t("save")}
          </Button>
        </StickyActions>
      ) : null}
    </form>
  );
}

function Toggle({ id, label, hint, checked, disabled, onChange }: { id: string; label: string; hint?: ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} label={label} checked={checked} disabled={disabled} onChange={onChange} />
      <label htmlFor={id} className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </label>
    </div>
  );
}
