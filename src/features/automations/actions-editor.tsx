"use client";

import { AlarmClock, ArrowDown, ShieldCheck, ArrowUp, Bell, Bot, GitBranch, Hand, LayoutGrid, Lock, MessageCircle, MessagesSquare, PenLine, Plus, Tag, TagsIcon, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/misc";
import { useCardSets } from "@/features/catalog/data";
import type { ActionKind, RuleAction } from "@/lib/api/types";
import { commentTriggers } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { useFlows } from "./data";
import { MessageBuilder } from "./message-builder";
import { allowedActions, baseVariables, capturePhoneProblem, commentVariables, emptyMessage, followUpSeconds, MAX_ACTIONS, MAX_PUBLIC_REPLIES, newAction, splitFollowUpDelay } from "./model";

export const actionIcons: Record<ActionKind, LucideIcon> = {
  send_message: MessageCircle,
  private_reply: Lock,
  public_reply: MessagesSquare,
  send_cards: LayoutGrid,
  start_flow: GitBranch,
  add_tag: Tag,
  remove_tag: TagsIcon,
  set_field: PenLine,
  handoff: Hand,
  pause_ai: Bot,
  notify_team: Bell,
  schedule_followup: AlarmClock,
  capture_phone: ShieldCheck,
};

export function ActionsEditor({
  ws,
  triggerKind,
  actions,
  onChange,
  fieldError,
  disabled,
  allowed: allowedOverride,
}: {
  ws: string;
  triggerKind: string;
  actions: RuleAction[];
  /** Overrides the trigger's list (flow action nodes allow tag, field, handoff, AI pause and team alerts only). */
  allowed?: ActionKind[];
  onChange: (actions: RuleAction[]) => void;
  /** Field error code for a path such as `actions[0].message`, already translated. */
  fieldError: (path: string) => string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("automations.actions");
  const [adding, setAdding] = useState(false);
  const allowed = allowedOverride ?? allowedActions(triggerKind);
  const variables = commentTriggers.includes(triggerKind) ? [...baseVariables, ...commentVariables] : baseVariables;
  const once: ActionKind[] = ["private_reply", "public_reply", "start_flow", "schedule_followup"];
  const addable = allowed.filter((k) => !(once.includes(k) && actions.some((a) => a.kind === k)));

  const set = (i: number, patch: Partial<RuleAction>) => onChange(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const move = (i: number, by: number) => {
    const next = [...actions];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fieldError("actions") ? (
        <p role="alert" className="text-sm text-danger">
          {fieldError("actions")}
        </p>
      ) : null}
      {actions.map((a, i) => {
        const Icon = actionIcons[a.kind as ActionKind] ?? MessageCircle;
        const notAllowed = !allowed.includes(a.kind as ActionKind);
        const err = fieldError(`actions[${i}]`);
        return (
          <Card key={i} className="overflow-visible">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium">
                <span className="text-muted-foreground">{toPersianDigits(i + 1)}. </span>
                {t(`kinds.${a.kind}` as "kinds.send_message")}
              </p>
              <Button variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={disabled || i === actions.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={t("remove")} disabled={disabled} onClick={() => onChange(actions.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
            <div className="space-y-3 p-3 sm:p-4">
              {notAllowed ? (
                <p role="alert" className="text-sm text-danger">
                  {t("notAllowed")}
                </p>
              ) : null}
              {err ? (
                <p role="alert" className="text-sm text-danger">
                  {err}
                </p>
              ) : null}
              <ActionBody ws={ws} index={i} action={a} variables={variables} onChange={(patch) => set(i, patch)} fieldError={fieldError} disabled={disabled} />
            </div>
          </Card>
        );
      })}

      {actions.length < MAX_ACTIONS && !disabled ? (
        adding ? (
          <Card className="p-3">
            <p className="mb-2 text-sm font-medium">{t("choose")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {addable.map((k) => {
                const Icon = actionIcons[k];
                return (
                  <button
                    key={k}
                    type="button"
                    className="flex items-start gap-3 rounded-xl border p-3 text-start hover:border-primary/50 hover:bg-primary-soft/40"
                    onClick={() => {
                      onChange([...actions, newAction(k)]);
                      setAdding(false);
                    }}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t(`kinds.${k}`)}</span>
                      <span className="block text-xs text-muted-foreground">{t(`hints.${k}`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
          </Card>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        )
      ) : null}
    </div>
  );
}

function ActionBody({
  ws,
  index,
  action: a,
  variables,
  onChange,
  fieldError,
  disabled,
}: {
  ws: string;
  index: number;
  action: RuleAction;
  variables: readonly string[];
  onChange: (patch: Partial<RuleAction>) => void;
  fieldError: (path: string) => string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("automations.actions");
  const id = `action-${index}`;
  const path = `actions[${index}]`;

  switch (a.kind) {
    case "send_message":
    case "private_reply":
      return (
        <>
          {a.kind === "private_reply" ? <p className="text-xs text-muted-foreground">{t("privateReplyHint")}</p> : null}
          <MessageBuilder
            id={`${id}-message`}
            value={a.message ?? emptyMessage()}
            onChange={(message) => onChange({ message })}
            variables={variables}
            disabled={disabled}
            error={fieldError(`${path}.message`)}
          />
        </>
      );
    case "public_reply": {
      const replies = a.replies ?? [];
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("publicReplyHint")}</p>
          {fieldError(`${path}.replies`) ? (
            <p role="alert" className="text-sm text-danger">
              {fieldError(`${path}.replies`)}
            </p>
          ) : null}
          {replies.map((r, j) => (
            <div key={j} className="flex items-center gap-2">
              <Input
                aria-label={t("replyVariant", { n: toPersianDigits(j + 1) })}
                dir="auto"
                maxLength={300}
                disabled={disabled}
                value={r}
                placeholder={t("replyPlaceholder")}
                onChange={(e) => onChange({ replies: replies.map((x, k) => (k === j ? e.target.value : x)) })}
              />
              <Button variant="ghost" size="icon-sm" aria-label={t("remove")} disabled={disabled || replies.length === 1} onClick={() => onChange({ replies: replies.filter((_, k) => k !== j) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          {replies.length < MAX_PUBLIC_REPLIES ? (
            <Button variant="link" size="sm" className="h-auto px-0" disabled={disabled} onClick={() => onChange({ replies: [...replies, ""] })}>
              <Plus aria-hidden />
              {t("addVariant")}
            </Button>
          ) : null}
        </div>
      );
    }
    case "send_cards":
      return <CardSetSelect ws={ws} id={`${id}-cards`} value={a.cardSetId ?? null} onChange={(cardSetId) => onChange({ cardSetId })} error={fieldError(`${path}.cardSetId`)} disabled={disabled} />;
    case "start_flow":
      return <FlowSelect ws={ws} id={`${id}-flow`} value={a.flowId ?? null} onChange={(flowId) => onChange({ flowId })} error={fieldError(`${path}.flowId`)} disabled={disabled} />;
    case "add_tag":
    case "remove_tag":
      return (
        <Field label={t("tag")} htmlFor={`${id}-tag`} error={fieldError(`${path}.tag`)}>
          <Input id={`${id}-tag`} dir="auto" maxLength={50} disabled={disabled} value={a.tag ?? ""} placeholder={t("tagPlaceholder")} onChange={(e) => onChange({ tag: e.target.value })} />
        </Field>
      );
    case "set_field":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("field")} htmlFor={`${id}-field`} error={fieldError(`${path}.field`)}>
            <Input id={`${id}-field`} dir="ltr" maxLength={40} disabled={disabled} value={a.field ?? ""} placeholder="city" onChange={(e) => onChange({ field: e.target.value })} />
          </Field>
          <Field label={t("value")} htmlFor={`${id}-value`}>
            <Input id={`${id}-value`} dir="auto" maxLength={500} disabled={disabled} value={a.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
          </Field>
        </div>
      );
    case "handoff":
      return (
        <Field label={`${t("reason")} (${t("optional")})`} htmlFor={`${id}-reason`} hint={t("handoffHint")}>
          <Textarea id={`${id}-reason`} dir="auto" rows={2} className="min-h-0" maxLength={200} disabled={disabled} value={a.reason ?? ""} onChange={(e) => onChange({ reason: e.target.value })} />
        </Field>
      );
    case "notify_team":
      return (
        <Field label={t("notifyTitle")} htmlFor={`${id}-title`} error={fieldError(`${path}.title`)}>
          <Input id={`${id}-title`} dir="auto" maxLength={100} disabled={disabled} value={a.title ?? ""} placeholder={t("notifyPlaceholder")} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
      );
    case "pause_ai":
      return <p className="text-sm text-muted-foreground">{t("hints.pause_ai")}</p>;
    case "capture_phone":
      return <CapturePhoneBody id={id} action={a} onChange={onChange} disabled={disabled} />;
    case "schedule_followup":
      return <FollowUpBody id={id} path={path} action={a} variables={variables} onChange={onChange} fieldError={fieldError} disabled={disabled} />;
    default:
      return null;
  }
}

function FlowSelect({ ws, id, value, onChange, error, disabled }: { ws: string; id: string; value: string | null; onChange: (id: string | null) => void; error: string | null; disabled?: boolean }) {
  const t = useTranslations("automations.actions");
  const flows = useFlows(ws);
  const published = (flows.data ?? []).filter((f) => f.publishedVersion !== null && f.publishedVersion !== undefined);
  return (
    <Field
      label={t("flow")}
      htmlFor={id}
      error={error}
      hint={
        <>
          {t("flowHint")}{" "}
          <Link href={`/w/${ws}/automations/flows`} className="text-primary hover:underline">
            {t("manageFlows")}
          </Link>
        </>
      }
    >
      <Select id={id} disabled={disabled || flows.isPending} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-invalid={Boolean(error) || undefined}>
        <option value="">{flows.isPending ? "…" : published.length ? t("chooseFlow") : t("noPublishedFlows")}</option>
        {published.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function CardSetSelect({ ws, id, value, onChange, error, disabled }: { ws: string; id: string; value: string | null; onChange: (id: string | null) => void; error: string | null; disabled?: boolean }) {
  const t = useTranslations("automations.actions");
  const sets = useCardSets(ws);
  return (
    <Field
      label={t("cardSet")}
      htmlFor={id}
      error={error}
      hint={
        <Link href={`/w/${ws}/catalog/storefront-cards`} className="text-primary hover:underline">
          {t("manageCardSets")}
        </Link>
      }
    >
      <Select id={id} disabled={disabled || sets.isPending} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-invalid={Boolean(error) || undefined}>
        <option value="">{sets.isPending ? "…" : sets.data?.length ? t("chooseCardSet") : t("noCardSets")}</option>
        {(sets.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** «پیگیری»: a message sent later in the same conversation, unless the customer answers or buys first (BE-1.8). */
export function FollowUpBody({
  id,
  path,
  action: a,
  variables,
  onChange,
  fieldError,
  disabled,
}: {
  id: string;
  path: string;
  action: RuleAction;
  variables: readonly string[];
  onChange: (patch: Partial<RuleAction>) => void;
  fieldError: (path: string) => string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("automations.actions.followup");
  const { amount, unit } = splitFollowUpDelay(Number(a.delaySeconds ?? 3600));
  const max = unit === "hours" ? 23 : 23 * 60;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <MessageBuilder id={`${id}-message`} value={a.message ?? emptyMessage()} onChange={(message) => onChange({ message })} variables={variables} disabled={disabled} error={fieldError(`${path}.message`)} />
      <Field label={t("delay")} htmlFor={`${id}-delay`} hint={t("delayHint")} error={fieldError(`${path}.delaySeconds`)}>
        <div className="flex gap-2">
          <Input
            id={`${id}-delay`}
            type="number"
            dir="ltr"
            min={1}
            max={max}
            className="w-28"
            disabled={disabled}
            value={amount}
            onChange={(e) => onChange({ delaySeconds: followUpSeconds(Number(e.target.value) || 1, unit) })}
          />
          <Select aria-label={t("unit")} className="w-32" disabled={disabled} value={unit} onChange={(e) => onChange({ delaySeconds: followUpSeconds(amount, e.target.value as "minutes" | "hours") })}>
            <option value="minutes">{t("minutes")}</option>
            <option value="hours">{t("hours")}</option>
          </Select>
        </div>
      </Field>
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{t("cancelOnReply")}</span>
          <Switch label={t("cancelOnReply")} checked={a.cancelOnReply ?? true} disabled={disabled} onChange={(cancelOnReply) => onChange({ cancelOnReply })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{t("cancelOnPurchase")}</span>
          <Switch label={t("cancelOnPurchase")} checked={a.cancelOnPurchase ?? true} disabled={disabled} onChange={(cancelOnPurchase) => onChange({ cancelOnPurchase })} />
        </label>
      </div>
    </div>
  );
}

/** «ذخیره شماره با رضایت» (BE-2.7, flows only): saves the mobile on the contact and records the SMS consent. */
export function CapturePhoneBody({ id, action: a, onChange, disabled }: { id: string; action: RuleAction; onChange: (patch: Partial<RuleAction>) => void; disabled?: boolean }) {
  const t = useTranslations("automations.actions.capturePhone");
  const problem = capturePhoneProblem(a);
  const consentLength = a.consentText?.trim().length ?? 0;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">{t("help")}</p>
      <Field label={t("value")} htmlFor={`${id}-phone`} hint={t("valueHint")} error={problem === "value" ? t("valueInvalid") : null}>
        <Input id={`${id}-phone`} dir="ltr" maxLength={100} disabled={disabled} value={a.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
      </Field>
      <Field label={t("consentText")} htmlFor={`${id}-consent`} hint={t("consentHint")} error={problem === "consentText" && consentLength > 0 ? t("consentInvalid") : null}>
        <Textarea id={`${id}-consent`} dir="auto" rows={2} maxLength={500} disabled={disabled} value={a.consentText ?? ""} placeholder={t("consentPlaceholder")} onChange={(e) => onChange({ consentText: e.target.value })} />
      </Field>
    </div>
  );
}
