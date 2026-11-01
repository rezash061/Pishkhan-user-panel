"use client";

import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { CrmTag } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useDeleteTag, useRenameTag, useSaveTag, useTags } from "./data";
import { swatches, TagChip, tagColors } from "./tag";

export function TagsPage() {
  const t = useTranslations("contacts.tagsPage");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.crmWrite);
  const tags = useTags(workspace.id);
  const remove = useDeleteTag(workspace.id);
  const [editing, setEditing] = useState<CrmTag | "new" | null>(null);
  const [deleting, setDeleting] = useState<CrmTag | null>(null);
  const list = tags.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        {writable ? (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {tags.isPending ? (
          <div className="p-4">
            <Skeleton className="h-24" />
          </div>
        ) : tags.isError ? (
          <EmptyState title={errorMessage(tags.error)} />
        ) : list.length === 0 ? (
          <EmptyState icon={<Tags />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          list.map((tag) => (
            <div key={tag.name} className="flex items-center gap-3 p-3 sm:p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <TagChip name={tag.name} color={tag.color} />
                  {!tag.defined ? <Badge>{t("undefined")}</Badge> : null}
                </p>
                {tag.description ? (
                  <p className="text-sm text-muted-foreground" dir="auto">
                    {tag.description}
                  </p>
                ) : null}
              </div>
              <Link href={`/w/${workspace.id}/contacts?tag=${encodeURIComponent(tag.name)}`} className="shrink-0 text-sm text-primary hover:underline">
                {t("contactCount", { n: formatNumber(tag.contactCount) })}
              </Link>
              {writable ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(tag)} aria-label={t("edit", { tag: tag.name })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(tag)} aria-label={t("delete", { tag: tag.name })}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {editing ? <TagDialog tag={editing === "new" ? null : editing} all={list} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteTitle", { tag: deleting?.name ?? "" })}
        body={t("deleteBody", { n: formatNumber(deleting?.contactCount ?? 0) })}
        confirmLabel={t("deleteConfirm")}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(deleting!.name, {
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

function TagDialog({ tag, all, onClose }: { tag: CrmTag | null; all: CrmTag[]; onClose: () => void }) {
  const t = useTranslations("contacts.tagsPage");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const save = useSaveTag(workspace.id);
  const rename = useRenameTag(workspace.id);
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState<string>(tag?.color ?? "gray");
  const [description, setDescription] = useState(tag?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const mergesInto = tag && trimmed !== tag.name ? all.find((x) => x.name === trimmed) : undefined;
  const busy = save.isPending || rename.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (tag && trimmed !== tag.name) await rename.mutateAsync({ name: tag.name, newName: trimmed });
      // Renaming onto an existing tag keeps that tag's look, so colour and description are only sent otherwise.
      if (!mergesInto) await save.mutateAsync({ name: trimmed, color, description: description.trim() || null });
      toast.success(mergesInto ? t("merged", { tag: trimmed }) : t("saved"));
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) return setError(t("invalidName"));
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tag ? t("editTitle") : t("newTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="crm-tag-form" loading={busy} disabled={!trimmed}>
            {mergesInto ? t("mergeButton") : t("save")}
          </Button>
        </>
      }
    >
      <form id="crm-tag-form" onSubmit={submit} className="space-y-4">
        <Field label={t("name")} htmlFor="tag-name" error={error ?? undefined} hint={mergesInto ? t("mergeHint", { tag: trimmed }) : tag ? t("renameHint") : undefined}>
          <Input id="tag-name" dir="auto" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <fieldset disabled={Boolean(mergesInto)} className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t("color")}</legend>
          <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2">
            {tagColors.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={t(`colors.${c}`)}
                onClick={() => setColor(c)}
                className={cn("grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-ring")}
              >
                <span className={cn("size-6 rounded-full", swatches[c])} />
              </button>
            ))}
          </div>
          <p className="pt-1">
            <TagChip name={trimmed || t("preview")} color={color} />
          </p>
        </fieldset>
        <Field label={t("description")} htmlFor="tag-description">
          <Input id="tag-description" dir="auto" maxLength={200} value={description} disabled={Boolean(mergesInto)} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
