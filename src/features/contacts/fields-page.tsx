"use client";

import { ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipsInput } from "@/components/ui/chips-input";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { FieldDefinition } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useDeleteField, useFields, useSaveField } from "./data";
import { fieldTypes } from "./field-input";

const MAX_FIELDS = 50;

/** A key the backend accepts (`^[a-z][a-z0-9_]{0,39}$`) from a label, when the label has Latin letters to work with. */
export function suggestKey(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+/, "")
      .replace(/_+$/, "")
      .slice(0, 34) || "field";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
}

export function FieldsPage() {
  const t = useTranslations("contacts.fields");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.crmWrite);
  const fields = useFields(workspace.id);
  const remove = useDeleteField(workspace.id);
  const [editing, setEditing] = useState<FieldDefinition | "new" | null>(null);
  const [deleting, setDeleting] = useState<FieldDefinition | null>(null);
  const list = fields.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        {writable ? (
          <Button onClick={() => setEditing("new")} disabled={list.length >= MAX_FIELDS}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {fields.isPending ? (
          <div className="p-4">
            <Skeleton className="h-24" />
          </div>
        ) : fields.isError ? (
          <EmptyState title={errorMessage(fields.error)} />
        ) : list.length === 0 ? (
          <EmptyState icon={<ListPlus />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          list.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium" dir="auto">
                  {f.label}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge>{t(`types.${f.type}` as "types.text")}</Badge>
                  <code dir="ltr">{f.key}</code>
                  {f.type === "select" ? <span>{t("optionCount", { n: toPersianDigits(f.options.length) })}</span> : null}
                </p>
              </div>
              {writable ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(f)} aria-label={t("edit", { label: f.label })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(f)} aria-label={t("delete", { label: f.label })}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {editing ? <FieldDialog field={editing === "new" ? null : editing} all={list} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteTitle", { label: deleting?.label ?? "" })}
        body={t("deleteBody")}
        confirmLabel={t("deleteConfirm")}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(deleting!.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(t("deleted"));
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}

function FieldDialog({ field, all, onClose }: { field: FieldDefinition | null; all: FieldDefinition[]; onClose: () => void }) {
  const t = useTranslations("contacts.fields");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const save = useSaveField(workspace.id);
  const taken = new Set(all.filter((f) => f.id !== field?.id).map((f) => f.key));
  const [label, setLabel] = useState(field?.label ?? "");
  const [key, setKey] = useState(field?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(field));
  const [type, setType] = useState(field?.type ?? "text");
  const [options, setOptions] = useState<string[]>(field?.options ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const effectiveKey = keyTouched ? key : suggestKey(label, taken);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const sortOrder = field?.sortOrder ?? Math.max(0, ...all.map((f) => f.sortOrder)) + 10;
    save.mutate(
      { id: field?.id ?? null, body: { key: field ? field.key : effectiveKey, label: label.trim(), type, options: type === "select" ? options : null, sortOrder } },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) return setErrors({ key: t("keyTaken") });
          if (err instanceof ApiError && err.status === 400) {
            const next: Record<string, string> = {};
            for (const f of ["key", "label", "type", "options"]) {
              const code = err.field(f);
              if (code) next[f] = codeMessage(code) ?? t(`invalid.${f}` as "invalid.key");
            }
            if (Object.keys(next).length) return setErrors(next);
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={field ? t("editTitle") : t("newTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="crm-field-form" loading={save.isPending} disabled={!label.trim() || (type === "select" && options.length === 0)}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="crm-field-form" onSubmit={submit} className="space-y-4">
        <Field label={t("label")} htmlFor="cf-label" error={errors.label}>
          <Input id="cf-label" dir="auto" maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
        <Field label={t("key")} htmlFor="cf-key" hint={field ? t("keyFixed") : t("keyHint")} error={errors.key}>
          <Input
            id="cf-key"
            dir="ltr"
            maxLength={40}
            disabled={Boolean(field)}
            value={effectiveKey}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            }}
          />
        </Field>
        <Field label={t("type")} htmlFor="cf-type" error={errors.type}>
          <Select id="cf-type" value={type} onChange={(e) => setType(e.target.value)}>
            {fieldTypes.map((x) => (
              <option key={x} value={x}>
                {t(`types.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        {type === "select" ? (
          <Field label={t("options")} htmlFor="cf-options" hint={t("optionsHint")} error={errors.options}>
            <ChipsInput id="cf-options" values={options} onChange={setOptions} max={50} maxLength={100} />
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
