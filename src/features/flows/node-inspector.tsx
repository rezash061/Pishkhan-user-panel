"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChipsInput } from "@/components/ui/chips-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { ActionsEditor } from "@/features/automations/actions-editor";
import { MessageBuilder } from "@/features/automations/message-builder";
import { baseVariables, emptyMessage } from "@/features/automations/model";
import { useCardSets } from "@/features/catalog/data";
import type { ActionKind, FlowCondition, FlowNode, FlowNodeType } from "@/lib/api/types";
import { answerTypes, flowNodeTypes } from "@/lib/api/types";
import { MAX_DELAY_SECONDS, MIN_DELAY_SECONDS, splitDelay, unitSeconds, VARIABLE_PATTERN } from "./model";

const flowActionKinds: ActionKind[] = ["add_tag", "remove_tag", "set_field", "handoff", "pause_ai", "notify_team"];
const subjects = ["tag", "field", "variable", "time"] as const;
const opsFor: Record<string, string[]> = {
  tag: ["has", "not_has"],
  field: ["equals", "not_equals", "contains", "exists", "not_exists", "gt", "lt"],
  variable: ["equals", "not_equals", "contains", "exists", "not_exists", "gt", "lt"],
  time: ["inside_hours", "outside_hours"],
};

/** Fields of one flow step (plan 3.4 node inspector). Edits apply to the draft at once; «ذخیره» stores the draft. */
export function NodeInspector({
  ws,
  node,
  variables,
  onChange,
  onChangeType,
  disabled,
}: {
  ws: string;
  node: FlowNode;
  /** Answers collected by question steps, usable as {{flow.name}}. */
  variables: string[];
  onChange: (patch: Partial<FlowNode>) => void;
  onChangeType: (type: FlowNodeType) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("flows");
  const id = `node-${node.id}`;
  const allVariables = [...baseVariables, ...variables.map((v) => `flow.${v}`)];

  return (
    <div className="space-y-4">
      <Field label={t("inspector.type")} htmlFor={`${id}-type`} hint={t(`typeHints.${node.type}` as "typeHints.message")}>
        <Select id={`${id}-type`} disabled={disabled} value={node.type} onChange={(e) => onChangeType(e.target.value as FlowNodeType)}>
          {flowNodeTypes.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </Select>
      </Field>

      {node.type === "message" ? (
        <MessageBuilder id={`${id}-message`} value={node.message ?? emptyMessage()} onChange={(message) => onChange({ message })} variables={allVariables} disabled={disabled} />
      ) : null}

      {node.type === "question" ? (
        <>
          <MessageBuilder
            id={`${id}-prompt`}
            value={node.message ?? emptyMessage()}
            onChange={(message) => onChange({ message })}
            variables={allVariables}
            disabled={disabled}
            allowExtras={false}
            placeholder={t("inspector.promptPlaceholder")}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("inspector.answerType")} htmlFor={`${id}-answer`}>
              <Select id={`${id}-answer`} disabled={disabled} value={node.answerType ?? "text"} onChange={(e) => onChange({ answerType: e.target.value, choices: e.target.value === "choice" ? (node.choices?.length ? node.choices : []) : null })}>
                {answerTypes.map((a) => (
                  <option key={a} value={a}>
                    {t(`answers.${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("inspector.variable")}
              htmlFor={`${id}-variable`}
              hint={t("inspector.variableHint", { token: `{{flow.${node.variable || "…"}}}` })}
              error={node.variable && !VARIABLE_PATTERN.test(node.variable) ? t("inspector.variableInvalid") : null}
            >
              <Input id={`${id}-variable`} dir="ltr" maxLength={40} disabled={disabled} value={node.variable ?? ""} onChange={(e) => onChange({ variable: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
            </Field>
          </div>
          {node.answerType === "choice" ? (
            <Field label={t("inspector.choices")} htmlFor={`${id}-choices`} hint={t("inspector.choicesHint")}>
              <ChipsInput id={`${id}-choices`} values={node.choices ?? []} onChange={(choices) => onChange({ choices })} max={13} maxLength={20} disabled={disabled} />
            </Field>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label={t("inspector.retryText")} htmlFor={`${id}-retry`} hint={t("inspector.retryHint")}>
              <Input id={`${id}-retry`} dir="auto" maxLength={300} disabled={disabled} value={node.retryText ?? ""} onChange={(e) => onChange({ retryText: e.target.value || null })} />
            </Field>
            <Field label={t("inspector.maxRetries")} htmlFor={`${id}-retries`}>
              <Input id={`${id}-retries`} type="number" dir="ltr" min={0} max={5} disabled={disabled} value={node.maxRetries ?? 0} onChange={(e) => onChange({ maxRetries: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} />
            </Field>
          </div>
        </>
      ) : null}

      {node.type === "condition" ? <ConditionEditor id={id} node={node} variables={variables} onChange={onChange} disabled={disabled} /> : null}

      {node.type === "delay" ? <DelayEditor id={id} seconds={Number(node.delaySeconds ?? 3600)} onChange={(delaySeconds) => onChange({ delaySeconds })} disabled={disabled} /> : null}

      {node.type === "storefront" ? <StorefrontSelect ws={ws} id={`${id}-cards`} value={node.cardSetId ?? null} onChange={(cardSetId) => onChange({ cardSetId })} disabled={disabled} /> : null}

      {node.type === "action" ? (
        <ActionsEditor ws={ws} triggerKind="dm_keyword" allowed={flowActionKinds} actions={node.actions ?? []} onChange={(actions) => onChange({ actions })} fieldError={() => null} disabled={disabled} />
      ) : null}

      {node.type === "ai" ? (
        <Field label={t("inspector.goal")} htmlFor={`${id}-goal`} hint={t("inspector.goalHint")}>
          <Textarea id={`${id}-goal`} dir="auto" maxLength={500} disabled={disabled} value={node.goal ?? ""} placeholder={t("inspector.goalPlaceholder")} onChange={(e) => onChange({ goal: e.target.value })} />
        </Field>
      ) : null}

      {node.type === "end" ? <p className="text-sm text-muted-foreground">{t("typeHints.end")}</p> : null}
    </div>
  );
}

function ConditionEditor({ id, node, variables, onChange, disabled }: { id: string; node: FlowNode; variables: string[]; onChange: (patch: Partial<FlowNode>) => void; disabled?: boolean }) {
  const t = useTranslations("flows");
  const conditions = node.conditions ?? [];
  const set = (i: number, patch: Partial<FlowCondition>) => onChange({ conditions: conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-3">
      <Segmented
        label={t("inspector.match")}
        value={node.match === "any" ? "any" : "all"}
        disabled={disabled}
        onChange={(match) => onChange({ match })}
        options={[
          { value: "all", label: t("inspector.matchAll") },
          { value: "any", label: t("inspector.matchAny") },
        ]}
      />
      {conditions.map((c, i) => {
        const needsName = c.subject === "field" || c.subject === "variable";
        const needsValue = c.subject === "tag" || (needsName && c.op !== "exists" && c.op !== "not_exists");
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
            <Select aria-label={t("inspector.subject")} className="h-9 w-32" disabled={disabled} value={c.subject} onChange={(e) => set(i, { subject: e.target.value, op: opsFor[e.target.value]![0]!, name: null, value: e.target.value === "time" ? null : (c.value ?? "") })}>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {t(`subjects.${s}`)}
                </option>
              ))}
            </Select>
            {needsName ? (
              c.subject === "variable" && variables.length ? (
                <Select aria-label={t("inspector.name")} className="h-9 w-32" disabled={disabled} value={c.name ?? ""} onChange={(e) => set(i, { name: e.target.value })}>
                  <option value="">—</option>
                  {variables.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input aria-label={t("inspector.name")} dir="ltr" className="h-9 w-32" disabled={disabled} value={c.name ?? ""} placeholder="city" onChange={(e) => set(i, { name: e.target.value })} />
              )
            ) : null}
            <Select aria-label={t("inspector.op")} className="h-9 w-36" disabled={disabled} value={c.op} onChange={(e) => set(i, { op: e.target.value })}>
              {opsFor[c.subject]!.map((op) => (
                <option key={op} value={op}>
                  {t(`ops.${op}` as "ops.has")}
                </option>
              ))}
            </Select>
            {needsValue ? <Input aria-label={t("inspector.value")} dir="auto" className="h-9 min-w-28 flex-1" disabled={disabled} value={c.value ?? ""} onChange={(e) => set(i, { value: e.target.value })} /> : null}
            <Button variant="ghost" size="icon-sm" aria-label={t("inspector.removeCondition")} disabled={disabled || conditions.length === 1} onClick={() => onChange({ conditions: conditions.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
        );
      })}
      {conditions.length < 10 ? (
        <Button variant="link" size="sm" className="h-auto px-0" disabled={disabled} onClick={() => onChange({ conditions: [...conditions, { subject: "tag", op: "has", value: "" }] })}>
          <Plus aria-hidden />
          {t("inspector.addCondition")}
        </Button>
      ) : null}
      <p id={`${id}-exits`} className="text-xs text-muted-foreground">
        {t("inspector.conditionExits")}
      </p>
    </div>
  );
}

function DelayEditor({ id, seconds, onChange, disabled }: { id: string; seconds: number; onChange: (seconds: number) => void; disabled?: boolean }) {
  const t = useTranslations("flows");
  const { amount, unit } = splitDelay(seconds);
  const clamp = (s: number) => Math.max(MIN_DELAY_SECONDS, Math.min(MAX_DELAY_SECONDS, s));
  return (
    <Field label={t("inspector.delay")} htmlFor={`${id}-delay`} hint={t("inspector.delayHint")}>
      <div className="flex gap-2">
        <Input id={`${id}-delay`} type="number" dir="ltr" min={1} className="w-28" disabled={disabled} value={amount} onChange={(e) => onChange(clamp((Number(e.target.value) || 1) * unitSeconds[unit]))} />
        <Select aria-label={t("inspector.unit")} className="w-32" disabled={disabled} value={unit} onChange={(e) => onChange(clamp(amount * unitSeconds[e.target.value as keyof typeof unitSeconds]))}>
          {(["minutes", "hours", "days"] as const).map((u) => (
            <option key={u} value={u}>
              {t(`units.${u}`)}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

function StorefrontSelect({ ws, id, value, onChange, disabled }: { ws: string; id: string; value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const t = useTranslations("automations.actions");
  const sets = useCardSets(ws);
  return (
    <Field label={t("cardSet")} htmlFor={id}>
      <Select id={id} disabled={disabled || sets.isPending} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{sets.data?.length ? t("chooseCardSet") : t("noCardSets")}</option>
        {(sets.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
