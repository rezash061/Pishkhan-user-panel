"use client";

import { Braces, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import type { MessageButton, OutboundContent } from "@/lib/api/types";
import { baseVariables, messageLimits, renderSample } from "./model";

type Extra = "none" | "buttons" | "quick";
import { toPersianDigits } from "@/lib/i18n/digits";
import { cn } from "@/lib/cn";

/**
 * Message builder (plan 3.4): text with {{variables}}, then either buttons (link or reply) or quick replies, with a live
 * preview in an Instagram-like RTL direct-message mock.
 */
export function MessageBuilder({
  id,
  value,
  onChange,
  variables = baseVariables,
  disabled,
  error,
  allowExtras = true,
  placeholder,
}: {
  id: string;
  value: OutboundContent;
  onChange: (value: OutboundContent) => void;
  variables?: readonly string[];
  disabled?: boolean;
  error?: string | null;
  allowExtras?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations("automations.message");
  const area = useRef<HTMLTextAreaElement>(null);
  const [varsOpen, setVarsOpen] = useState(false);
  const buttons = value.buttons ?? [];
  const quick = value.quickReplies ?? [];
  const extra: Extra = buttons.length ? "buttons" : quick.length ? "quick" : "none";
  const [mode, setMode] = useState<Extra>(extra);
  const limit = buttons.length ? messageLimits.textWithButtons : messageLimits.text;
  const text = value.text ?? "";

  const insertVariable = (name: string) => {
    const el = area.current;
    const token = `{{${name}}}`;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    onChange({ ...value, text: text.slice(0, start) + token + text.slice(end) });
    setVarsOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const setMode2 = (next: Extra) => {
    setMode(next);
    if (next === "none") onChange({ ...value, buttons: null, quickReplies: null });
    if (next === "buttons") onChange({ ...value, quickReplies: null, buttons: buttons.length ? buttons : [{ type: "postback", title: "", payload: "" }] });
    if (next === "quick") onChange({ ...value, buttons: null, quickReplies: quick.length ? quick : [{ title: "", payload: "" }] });
  };

  const setButton = (i: number, patch: Partial<MessageButton>) => onChange({ ...value, buttons: buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-3">
        <div className="relative">
          <Textarea
            id={id}
            ref={area}
            dir="auto"
            rows={4}
            disabled={disabled}
            maxLength={limit}
            placeholder={placeholder ?? t("placeholder")}
            value={text}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="relative">
              <Button variant="ghost" size="sm" className="h-7 px-2" disabled={disabled} aria-expanded={varsOpen} onClick={() => setVarsOpen((o) => !o)}>
                <Braces aria-hidden />
                {t("insertVariable")}
              </Button>
              {varsOpen ? (
                <div role="menu" className="absolute start-0 top-8 z-20 w-60 rounded-xl border bg-surface p-1 shadow-lg">
                  {variables.map((v) => (
                    <button key={v} type="button" role="menuitem" className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-surface-muted" onClick={() => insertVariable(v)}>
                      {t.has(`variables.${v.replace(".", "_")}`) ? t(`variables.${v.replace(".", "_")}` as "variables.contact_name") : v}
                      <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">{`{{${v}}}`}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className={cn("tabular-nums", text.length > limit * 0.9 && "text-danger")}>
              {toPersianDigits(text.length)}/{toPersianDigits(limit)}
            </span>
          </div>
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        {allowExtras ? (
          <div className="space-y-3">
            <Segmented
              label={t("extras")}
              value={mode}
              disabled={disabled}
              onChange={setMode2}
              options={[
                { value: "none", label: t("extrasNone") },
                { value: "buttons", label: t("buttons") },
                { value: "quick", label: t("quickReplies") },
              ]}
            />
            {mode === "buttons" ? (
              <div className="space-y-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                    <Segmented
                      label={t("buttonType")}
                      value={b.type === "web_url" ? "web_url" : "postback"}
                      disabled={disabled}
                      onChange={(type) => setButton(i, type === "web_url" ? { type, payload: null, url: b.url ?? "https://" } : { type, url: null, payload: b.payload ?? "" })}
                      options={[
                        { value: "postback", label: t("buttonReply") },
                        { value: "web_url", label: t("buttonLink") },
                      ]}
                    />
                    <Input
                      aria-label={t("buttonTitle")}
                      placeholder={t("buttonTitle")}
                      className="h-9 w-36 flex-1"
                      maxLength={messageLimits.title}
                      disabled={disabled}
                      value={b.title}
                      onChange={(e) => setButton(i, { title: e.target.value })}
                    />
                    {b.type === "web_url" ? (
                      <Input
                        aria-label={t("buttonUrl")}
                        placeholder="https://"
                        dir="ltr"
                        className="h-9 min-w-48 flex-[2]"
                        disabled={disabled}
                        value={b.url ?? ""}
                        onChange={(e) => setButton(i, { url: e.target.value })}
                      />
                    ) : (
                      <Input
                        aria-label={t("buttonPayload")}
                        placeholder={t("buttonPayloadHint")}
                        dir="ltr"
                        className="h-9 min-w-36 flex-[2]"
                        disabled={disabled}
                        value={b.payload ?? ""}
                        onChange={(e) => setButton(i, { payload: e.target.value })}
                      />
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label={t("remove")} disabled={disabled} onClick={() => onChange({ ...value, buttons: buttons.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {buttons.length < messageLimits.buttons ? (
                  <Button variant="link" size="sm" className="h-auto px-0" disabled={disabled} onClick={() => onChange({ ...value, buttons: [...buttons, { type: "postback", title: "", payload: "" }] })}>
                    <Plus aria-hidden />
                    {t("addButton")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {mode === "quick" ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("quickRepliesHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {quick.map((q, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input
                        aria-label={`${t("quickReply")} ${toPersianDigits(i + 1)}`}
                        className="h-9 w-36"
                        maxLength={messageLimits.title}
                        disabled={disabled}
                        value={q.title}
                        onChange={(e) => onChange({ ...value, quickReplies: quick.map((x, j) => (j === i ? { title: e.target.value, payload: e.target.value } : x)) })}
                      />
                      <Button variant="ghost" size="icon-sm" aria-label={t("remove")} disabled={disabled} onClick={() => onChange({ ...value, quickReplies: quick.filter((_, j) => j !== i) })}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  {quick.length < messageLimits.quickReplies ? (
                    <Button variant="outline" size="sm" className="h-9" disabled={disabled} onClick={() => onChange({ ...value, quickReplies: [...quick, { title: "", payload: "" }] })}>
                      <Plus aria-hidden />
                      {t("addQuickReply")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <DmPreview message={value} />
    </div>
  );
}

/** Instagram-like DM mock, right-to-left, so sellers see the message as their customer will. */
export function DmPreview({ message, className }: { message: OutboundContent; className?: string }) {
  const t = useTranslations("automations.message");
  const text = renderSample(message.text ?? "");
  const buttons = message.buttons ?? [];
  const quick = (message.quickReplies ?? []).filter((q) => q.title.trim());
  return (
    <figure className={cn("self-start rounded-3xl border bg-surface-muted/60 p-3", className)} aria-label={t("preview")}>
      <figcaption className="mb-2 text-center text-xs text-muted-foreground">{t("preview")}</figcaption>
      <div className="space-y-2">
        {text.trim() || buttons.length ? (
          <div className="me-auto max-w-[90%] overflow-hidden rounded-2xl rounded-ss-md bg-surface text-sm shadow-sm">
            {text.trim() ? (
              <p className="px-3 py-2 leading-7 whitespace-pre-wrap" dir="auto">
                {text}
              </p>
            ) : null}
            {buttons.map((b, i) => (
              <div key={i} className="flex items-center justify-center gap-1 border-t px-3 py-2 text-center font-medium text-primary">
                {b.title || "…"}
                {b.type === "web_url" ? <ExternalLink className="size-3.5" aria-hidden /> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("previewEmpty")}</p>
        )}
        {message.cards?.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {message.cards.map((c, i) => (
              <div key={i} className="w-40 shrink-0 overflow-hidden rounded-2xl bg-surface text-xs shadow-sm">
                <div className="aspect-square bg-border/50" />
                <p className="truncate px-2 pt-2 font-medium">{c.title}</p>
                {c.subtitle ? <p className="truncate px-2 pb-2 text-muted-foreground">{c.subtitle}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {quick.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {quick.map((q, i) => (
              <span key={i} className="rounded-full border border-primary/40 bg-surface px-3 py-1 text-xs text-primary">
                {q.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
