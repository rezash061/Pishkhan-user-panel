"use client";

import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer, StickyActions } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Segment, SegmentCondition, SegmentRule } from "@/lib/api/types";
import { toLatinDigits, toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useDeleteSegment, useFields, useSaveSegment, useSegmentPreview, useSegments, useTags } from "./data";
import { cleanRule, conditionFields, MAX_CONDITIONS, newCondition, opsByField, ruleIsComplete, valueKind, withField, withOp, type ConditionField } from "./rule";

export function SegmentEditorPage({ segmentId }: { segmentId: string | null }) {
  const t = useTranslations("contacts.segments");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const segments = useSegments(workspace.id);
  const segment = segmentId ? segments.data?.find((s) => s.id === segmentId) : null;

  return (
    <PageContainer className="max-w-3xl space-y-5">
      <Link href={`/w/${workspace.id}/contacts/segments`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("back")}
      </Link>
      {segmentId && segments.isPending ? (
        <Skeleton className="h-64" />
      ) : segmentId && segments.isError ? (
        <EmptyState title={errorMessage(segments.error)} />
      ) : segmentId && !segment ? (
        <EmptyState title={t("notFound")} />
      ) : (
        <Editor key={segment?.id ?? "new"} segment={segment ?? null} />
      )}
    </PageContainer>
  );
}

function Editor({ segment }: { segment: Segment | null }) {
  const t = useTranslations("contacts.segments");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.crmWrite);
  const save = useSaveSegment(ws);
  const remove = useDeleteSegment(ws);
  const [name, setName] = useState(segment?.name ?? "");
  const [rule, setRule] = useState<SegmentRule>(segment?.rule ?? { match: "all", conditions: [newCondition("tag")] });
  const [nameError, setNameError] = useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = useState<Record<number, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const complete = ruleIsComplete(rule);
  // Count matches while editing, 400 ms after the last change to a complete rule.
  const ruleKey = complete ? JSON.stringify(cleanRule(rule)) : null;
  const [debounced, setDebounced] = useState<SegmentRule | null>(ruleKey ? (JSON.parse(ruleKey) as SegmentRule) : null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(ruleKey ? (JSON.parse(ruleKey) as SegmentRule) : null), 400);
    return () => clearTimeout(timer);
  }, [ruleKey]);
  const preview = useSegmentPreview(ws, debounced);

  const setCondition = (i: number, c: SegmentCondition) => setRule((r) => ({ ...r, conditions: r.conditions.map((x, j) => (j === i ? c : x)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setRuleErrors({});
    save.mutate(
      { id: segment?.id ?? null, name: name.trim(), rule: cleanRule(rule) },
      {
        onSuccess: (saved) => {
          toast.success(t("saved"));
          if (!segment) router.replace(`/w/${ws}/contacts/segments/${saved.id}`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) return setNameError(t("nameTaken"));
          if (err instanceof ApiError && err.status === 400) {
            const next: Record<number, string> = {};
            for (const key of Object.keys(err.fields)) {
              const m = /conditions\[(\d+)\]/.exec(key);
              if (m) next[Number(m[1])] = t("conditionInvalid");
            }
            if (err.field("name")) setNameError(t("nameInvalid"));
            if (Object.keys(next).length) return setRuleErrors(next);
            if (err.field("name")) return;
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-xl font-bold sm:text-2xl">{segment ? t("editTitle") : t("newTitle")}</h1>
      <Card>
        <CardBody className="space-y-4">
          <Field label={t("name")} htmlFor="seg-name" error={nameError ?? undefined}>
            <Input id="seg-name" dir="auto" maxLength={100} value={name} disabled={!writable} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("matchPrefix")}</span>
            <Segmented
              label={t("match")}
              value={rule.match === "any" ? "any" : "all"}
              onChange={(match) => setRule((r) => ({ ...r, match }))}
              disabled={!writable}
              options={[
                { value: "all", label: t("matchAll") },
                { value: "any", label: t("matchAny") },
              ]}
            />
            <span>{t("matchSuffix")}</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("conditions")} />
        <CardBody className="space-y-3">
          <ol className="space-y-3">
            {rule.conditions.map((c, i) => (
              <li key={i}>
                <ConditionRow
                  index={i}
                  condition={c}
                  error={ruleErrors[i]}
                  disabled={!writable}
                  onChange={(next) => setCondition(i, next)}
                  onRemove={rule.conditions.length > 1 ? () => setRule((r) => ({ ...r, conditions: r.conditions.filter((_, j) => j !== i) })) : undefined}
                />
              </li>
            ))}
          </ol>
          {writable && rule.conditions.length < MAX_CONDITIONS ? (
            <Button variant="outline" size="sm" onClick={() => setRule((r) => ({ ...r, conditions: [...r.conditions, newCondition("tag")] }))}>
              <Plus aria-hidden />
              {t("addCondition")}
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
        <Users className="size-4 shrink-0" aria-hidden />
        {!complete
          ? t("previewIncomplete")
          : preview.isError
            ? t("previewError")
            : preview.data
              ? t("previewCount", { n: formatNumber(preview.data.contactCount) })
              : t("previewCounting")}
      </p>

      {writable ? (
        <StickyActions className="justify-between">
          {segment ? (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              {t("delete")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={save.isPending} disabled={!complete || !name.trim()}>
            {t("save")}
          </Button>
        </StickyActions>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title={t("deleteTitle", { name: segment?.name ?? "" })}
        body={t("deleteBody")}
        confirmLabel={t("delete")}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(segment!.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              router.replace(`/w/${ws}/contacts/segments`);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </form>
  );
}

function ConditionRow({
  index,
  condition: c,
  error,
  disabled,
  onChange,
  onRemove,
}: {
  index: number;
  condition: SegmentCondition;
  error?: string;
  disabled?: boolean;
  onChange: (c: SegmentCondition) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("contacts.segments");
  const { workspace } = useWorkspace();
  const fields = useFields(workspace.id);
  const tags = useTags(workspace.id);
  const channels = useChannels(workspace.id);
  const kind = valueKind(c);
  const n = toPersianDigits(index + 1);
  const field = c.field as ConditionField;
  const valueLabel = t("valueLabel", { n });

  return (
    <div className="rounded-xl border p-3" role="group" aria-label={t("conditionLabel", { n })} aria-describedby={error ? `seg-cond-error-${index}` : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t("fieldLabel", { n })} className="w-40" value={c.field} disabled={disabled} onChange={(e) => onChange(withField(c, e.target.value as ConditionField))}>
          {conditionFields.map((f) => (
            <option key={f} value={f}>
              {t(`fields.${f}`)}
            </option>
          ))}
        </Select>
        {c.field === "field" ? (
          <Select aria-label={t("customFieldLabel", { n })} className="w-40" value={c.key ?? ""} disabled={disabled} onChange={(e) => onChange({ ...c, key: e.target.value })}>
            <option value="">{t("pickField")}</option>
            {(fields.data ?? []).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        ) : null}
        <Select aria-label={t("opLabel", { n })} className="w-40" value={c.op} disabled={disabled} onChange={(e) => onChange(withOp(c, e.target.value))}>
          {opsByField[field].map((op) => (
            <option key={op} value={op}>
              {t(`ops.${op}` as "ops.has")}
            </option>
          ))}
        </Select>
        {kind === "tag" ? (
          <>
            <Input aria-label={valueLabel} className="w-40" list={`seg-tags-${index}`} dir="auto" maxLength={50} value={String(c.value ?? "")} disabled={disabled} onChange={(e) => onChange({ ...c, value: e.target.value })} />
            <datalist id={`seg-tags-${index}`}>
              {(tags.data ?? []).map((x) => (
                <option key={x.name} value={x.name} />
              ))}
            </datalist>
          </>
        ) : kind === "channel" ? (
          <Select aria-label={valueLabel} className="w-44" value={String(c.value ?? "")} disabled={disabled} onChange={(e) => onChange({ ...c, value: e.target.value })}>
            <option value="">{t("pickChannel")}</option>
            {(channels.data ?? []).map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.username ? `@${ch.username}` : ch.displayName}
              </option>
            ))}
          </Select>
        ) : kind === "days" ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <Input
              aria-label={valueLabel}
              className="w-20"
              inputMode="numeric"
              dir="ltr"
              value={toPersianDigits(String(c.value ?? ""))}
              disabled={disabled}
              onChange={(e) => {
                const digits = toLatinDigits(e.target.value).replace(/\D/g, "");
                onChange({ ...c, value: digits ? Number(digits) : null });
              }}
            />
            {t("days")}
          </span>
        ) : kind === "boolean" ? (
          <Select aria-label={valueLabel} className="w-32" value={c.value === false ? "false" : "true"} disabled={disabled} onChange={(e) => onChange({ ...c, value: e.target.value === "true" })}>
            <option value="true">{t("yes")}</option>
            <option value="false">{t("no")}</option>
          </Select>
        ) : kind === "text" ? (
          <Input aria-label={valueLabel} className="min-w-32 flex-1" dir="auto" maxLength={500} value={String(c.value ?? "")} disabled={disabled} onChange={(e) => onChange({ ...c, value: e.target.value })} />
        ) : null}
        {onRemove && !disabled ? (
          <Button variant="ghost" size="icon-sm" className="ms-auto" onClick={onRemove} aria-label={t("removeCondition", { n })}>
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={`seg-cond-error-${index}`} className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
