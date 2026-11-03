"use client";

import { BookOpen, Bot, CircleCheck, Info, ListChecks, MessageSquareText, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import type { TemplateApplication, TemplatePreview, TemplateSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { newIdempotencyKey, useApplyTemplate, useTemplatePreview, useTemplates } from "./data";
import { orderTemplates, resultLines } from "./model";

/**
 * Pick an industry template, preview what it adds and apply it (BE-2.9). Used by the onboarding «قالب» step and the
 * settings «قالب صنف» tab. Without `writable` the preview is shown but nothing can be applied.
 */
export function TemplatePicker({ ws, writable, onApplied }: { ws: string; writable: boolean; onApplied?: (result: TemplateApplication) => void }) {
  const t = useTranslations("templates");
  const errorMessage = useErrorMessage();
  const templates = useTemplates(ws);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<TemplateApplication | null>(null);
  const list = orderTemplates(templates.data ?? []);
  const selected = picked ?? list[0]?.id ?? null;

  if (templates.isPending) return <Skeleton className="h-48" />;
  if (templates.isError) return <p className="text-sm text-danger">{errorMessage(templates.error)}</p>;
  if (list.length === 0) return <EmptyState icon={<BookOpen />} title={t("empty")} body={t("emptyBody")} />;
  if (result) return <ApplyResult ws={ws} result={result} name={list.find((x) => x.id === result.templateId)?.name ?? ""} onBack={() => setResult(null)} />;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("pick")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((x) => (
            <TemplateOption key={x.id} template={x} checked={x.id === selected} onPick={() => setPicked(x.id)} />
          ))}
        </div>
      </fieldset>
      {selected ? (
        <Preview
          key={selected}
          ws={ws}
          templateId={selected}
          writable={writable}
          onApplied={(r) => {
            setResult(r);
            onApplied?.(r);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateOption({ template: x, checked, onPick }: { template: TemplateSummary; checked: boolean; onPick: () => void }) {
  const t = useTranslations("templates");
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-primary bg-primary-soft/60" : "hover:bg-surface-muted",
        x.recommended && !checked && "border-primary/50",
      )}
    >
      <input type="radio" name="template" value={x.id} checked={checked} onChange={onPick} className="sr-only" />
      <span className="flex flex-wrap items-center gap-1.5 font-medium">
        {x.name}
        {x.recommended ? (
          <Badge tone="primary">
            <Sparkles className="size-3" aria-hidden />
            {t("recommended")}
          </Badge>
        ) : null}
        {x.lastApplied ? <Badge tone="success">{t("applied")}</Badge> : null}
      </span>
      {x.description ? <span className="text-xs text-muted-foreground">{x.description}</span> : null}
      <span className="text-xs text-muted-foreground">{t("counts", { faqs: formatNumber(x.faqs), flows: formatNumber(x.flows), rules: formatNumber(x.rules) })}</span>
      {x.lastApplied ? <span className="text-xs text-muted-foreground">{t("lastApplied", { when: formatDateTime(x.lastApplied) })}</span> : null}
    </label>
  );
}

function Preview({ ws, templateId, writable, onApplied }: { ws: string; templateId: string; writable: boolean; onApplied: (r: TemplateApplication) => void }) {
  const t = useTranslations("templates");
  const errorMessage = useErrorMessage();
  const preview = useTemplatePreview(ws, templateId);
  const apply = useApplyTemplate(ws);
  const [key] = useState(newIdempotencyKey);

  if (preview.isPending) return <Skeleton className="h-64" />;
  if (preview.isError) return <p className="text-sm text-danger">{errorMessage(preview.error)}</p>;
  const p = preview.data;

  return (
    <section aria-labelledby="template-preview" className="space-y-3 rounded-2xl border p-4">
      <h2 id="template-preview" className="font-semibold">
        {t("previewTitle", { name: p.template.name })}
      </h2>
      <p className="flex items-start gap-2 rounded-xl bg-warning-soft/60 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("offNotice")}
      </p>
      <PreviewSections preview={p} />
      {apply.isError ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {errorMessage(apply.error)}
        </p>
      ) : null}
      {writable ? (
        <Button className="w-full" loading={apply.isPending} onClick={() => apply.mutate({ templateId, idempotencyKey: key }, { onSuccess: onApplied })}>
          {p.template.lastApplied ? t("applyAgain") : t("apply")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      {p.template.lastApplied && writable ? <p className="text-xs text-muted-foreground">{t("applyAgainHint")}</p> : null}
    </section>
  );
}

export function PreviewSections({ preview: p }: { preview: TemplatePreview }) {
  const t = useTranslations();
  return (
    <div className="space-y-2 text-sm">
      <Section icon={<ListChecks />} title={t("templates.facts", { n: formatNumber(p.requiredFacts.length) })}>
        <ul className="space-y-1.5">
          {p.requiredFacts.map((f) => (
            <li key={f.key}>
              <span className="font-medium">{f.label}:</span> <span className="text-muted-foreground">{f.prompt}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section icon={<MessageSquareText />} title={t("templates.faqs", { n: formatNumber(p.faqs.length) })}>
        <ul className="space-y-2">
          {p.faqs.map((f) => (
            <li key={f.key} className="rounded-lg bg-surface-muted p-2">
              <p className="font-medium">{f.question}</p>
              <p className="text-muted-foreground">{f.answer}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section icon={<Workflow />} title={t("templates.flows", { n: formatNumber(p.flows.length) })}>
        <ul className="list-inside list-disc">
          {p.flows.map((f) => (
            <li key={f.key}>{f.name}</li>
          ))}
        </ul>
      </Section>
      <Section icon={<Workflow />} title={t("templates.rules", { n: formatNumber(p.rules.length) })}>
        <ul className="space-y-1">
          {p.rules.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-2">
              {r.name}
              <Badge>{t.has(`automations.triggers.${r.triggerKind}`) ? t(`automations.triggers.${r.triggerKind}` as "automations.triggers.dm_keyword") : r.triggerKind}</Badge>
            </li>
          ))}
        </ul>
      </Section>
      {p.agentProfile ? (
        <Section icon={<Bot />} title={t("templates.agent")}>
          <dl className="space-y-1">
            <div>
              <dt className="inline font-medium">{t("templates.agentName")}: </dt>
              <dd className="inline">{p.agentProfile.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{t("templates.agentTone")}: </dt>
              <dd className="inline">{t.has(`agent.settings.tones.${p.agentProfile.tone}`) ? t(`agent.settings.tones.${p.agentProfile.tone}` as "agent.settings.tones.friendly") : p.agentProfile.tone}</dd>
            </div>
            {p.agentProfile.neverSay.length ? (
              <div>
                <dt className="inline font-medium">{t("templates.neverSay")}: </dt>
                <dd className="inline">{p.agentProfile.neverSay.join("، ")}</dd>
              </div>
            ) : null}
            {p.agentProfile.handoffKeywords.length ? (
              <div>
                <dt className="inline font-medium">{t("templates.handoffKeywords")}: </dt>
                <dd className="inline">{p.agentProfile.handoffKeywords.join("، ")}</dd>
              </div>
            ) : null}
          </dl>
          {p.agentProfile.brandVoice ? <p className="mt-1 text-muted-foreground">{p.agentProfile.brandVoice}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{t("templates.agentHint")}</p>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border p-3 [&_summary_svg]:size-4">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <span className="text-primary" aria-hidden>
          {icon}
        </span>
        {title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** What applying added, what it left alone, and where to fill the blanks and switch things on. */
export function ApplyResult({ ws, result, name, onBack }: { ws: string; result: TemplateApplication; name: string; onBack?: () => void }) {
  const t = useTranslations("templates");
  return (
    <div role="status" className="space-y-3 rounded-2xl border border-success/40 bg-success-soft/40 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <CircleCheck className="size-5 text-success" aria-hidden />
        {t("done", { name })}
      </p>
      <ul className="list-inside list-disc space-y-0.5">
        {resultLines(result).map(([key, n]) => (
          <li key={key}>{t(`result.${key}`, { n: formatNumber(n) })}</li>
        ))}
      </ul>
      <p>{t("nextSteps")}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/w/${ws}/knowledge`} className="text-primary underline underline-offset-2">
          {t("toKnowledge")}
        </Link>
        <Link href={`/w/${ws}/automations`} className="text-primary underline underline-offset-2">
          {t("toAutomations")}
        </Link>
      </div>
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t("back")}
        </Button>
      ) : null}
    </div>
  );
}
