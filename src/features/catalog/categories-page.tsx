"use client";

import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Category } from "@/lib/api/types";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useCategories, useDeleteCategory, useSaveCategory } from "./data";

/** Top-level categories with their children under them, each level by sort order then name. */
export function categoryTree(categories: Category[]): { category: Category; depth: number }[] {
  const sort = (a: Category, b: Category) => Number(a.sortOrder) - Number(b.sortOrder) || a.name.localeCompare(b.name, "fa");
  const ids = new Set(categories.map((c) => c.id));
  const out: { category: Category; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of categories.filter((x) => (x.parentId && ids.has(x.parentId) ? x.parentId : null) === parentId).sort(sort)) {
      out.push({ category: c, depth });
      if (depth < 5) walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function CategoriesPage() {
  const t = useTranslations("catalog.categories");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.catalogWrite);
  const categories = useCategories(ws);
  const remove = useDeleteCategory(ws);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        {writable ? (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {categories.isPending ? (
          <div className="p-4">
            <Skeleton className="h-10" />
          </div>
        ) : categories.isError ? (
          <EmptyState title={errorMessage(categories.error)} />
        ) : categories.data.length === 0 ? (
          <EmptyState icon={<FolderTree />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          categoryTree(categories.data).map(({ category: c, depth }) => (
            <div key={c.id} className="flex items-center gap-2 p-3 sm:px-4" style={{ paddingInlineStart: `${1 + depth * 1.5}rem` }}>
              <p className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                {depth > 0 ? <span className="text-muted-foreground">└ </span> : null}
                {c.name}
              </p>
              {writable ? (
                <>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t("edit")} ${c.name}`} onClick={() => setEditing(c)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`${t("delete")} ${c.name}`} onClick={() => setDeleting(c)}>
                    <Trash2 />
                  </Button>
                </>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {editing ? <CategoryDialog key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} all={categories.data ?? []} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteConfirm")}
        body={deleting ? `${deleting.name} — ${t("deleteHint")}` : null}
        confirmLabel={t("delete")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}

function CategoryDialog({ initial, all, onClose }: { initial: Category | null; all: Category[]; onClose: () => void }) {
  const t = useTranslations("catalog.categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const save = useSaveCategory(workspace.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);
  const err = save.error instanceof ApiError ? save.error : null;
  const nameError = err ? (codeMessage(err.field("name")) ?? (err.code === "catalog.category_exists" ? errorMessage(err) : null)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate({ id: initial?.id, name: name.trim(), parentId, sortOrder: initial ? Number(initial.sortOrder) : 0 }, { onSuccess: onClose });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      title={initial ? t("edit") : t("add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending} disabled={!name.trim()}>
            {tc("save")}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        {save.error && !nameError ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <Field label={t("name")} htmlFor="category-name" error={nameError}>
          <Input id="category-name" dir="auto" maxLength={100} value={name} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("parent")} htmlFor="category-parent">
          <Select id="category-parent" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            <option value="">{t("noParent")}</option>
            {all
              .filter((c) => c.id !== initial?.id && c.parentId !== initial?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
