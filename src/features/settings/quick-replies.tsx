"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useQuickReplies } from "@/features/inbox/data";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/keys";
import type { QuickReply } from "@/lib/api/types";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";

export function QuickRepliesSettings() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.inboxReply);
  const list = useQuickReplies(ws);
  const [editing, setEditing] = useState<QuickReply | "new" | null>(null);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/quick-replies/{id}", { params: { path: { workspaceId: ws, id } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: qk.quickReplies(ws) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("quickReplies.subtitle")}</p>
        {writable ? (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("quickReplies.add")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {list.isPending ? (
          <CardBody>
            <Skeleton className="h-12" />
          </CardBody>
        ) : list.isError ? (
          <EmptyState title={errorMessage(list.error)} />
        ) : list.data.length === 0 ? (
          <EmptyState icon={<Zap />} title={t("quickReplies.empty")} body={t("quickReplies.subtitle")} />
        ) : (
          list.data.map((q) => (
            <div key={q.id} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 shrink-0 rounded-lg bg-primary-soft px-2 py-0.5 font-mono text-xs text-primary" dir="ltr">
                /{q.shortcut}
              </span>
              <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap" dir="auto">
                {q.text}
              </p>
              {writable ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} onClick={() => setEditing(q)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={t("common.delete")} onClick={() => setDeleting(q)}>
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {editing ? <QuickReplyDialog key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        title={t("quickReplies.deleteConfirm")}
        body={deleting ? `/${deleting.shortcut}` : null}
        confirmLabel={t("common.delete")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function QuickReplyDialog({ initial, onClose }: { initial: QuickReply | null; onClose: () => void }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const [shortcut, setShortcut] = useState(initial?.shortcut ?? "");
  const [text, setText] = useState(initial?.text ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const body = { shortcut: shortcut.trim().replace(/^\//, ""), text: text.trim() };
      return initial
        ? unwrap(await api.PATCH("/api/v1/workspaces/{workspaceId}/quick-replies/{id}", { params: { path: { workspaceId: ws, id: initial.id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/quick-replies", { params: { path: { workspaceId: ws } }, body }));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.quickReplies(ws) });
      onClose();
    },
  });

  const err = save.error instanceof ApiError ? save.error : null;
  const shortcutError = err ? (codeMessage(err.field("shortcut")) ?? (err.code === "quick_reply.shortcut_taken" ? errorMessage(err) : null)) : null;
  const textError = err ? codeMessage(err.field("text")) : null;
  const generalError = save.error && !shortcutError && !textError ? errorMessage(save.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (shortcut.trim() && text.trim()) save.mutate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      title={initial ? t("common.edit") : t("quickReplies.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="quick-reply-form" loading={save.isPending} disabled={!shortcut.trim() || !text.trim()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="quick-reply-form" onSubmit={submit} className="space-y-4" noValidate>
        {generalError ? <p role="alert" className="text-sm text-danger">{generalError}</p> : null}
        <Field label={t("quickReplies.shortcut")} htmlFor="qr-shortcut" hint={t("quickReplies.shortcutHint")} error={shortcutError}>
          <Input id="qr-shortcut" dir="ltr" maxLength={41} required value={shortcut} onChange={(e) => setShortcut(e.target.value)} aria-invalid={Boolean(shortcutError)} />
        </Field>
        <Field label={t("quickReplies.text")} htmlFor="qr-text" error={textError}>
          <Textarea id="qr-text" dir="auto" maxLength={1000} required value={text} onChange={(e) => setText(e.target.value)} aria-invalid={Boolean(textError)} />
        </Field>
      </form>
    </Dialog>
  );
}
