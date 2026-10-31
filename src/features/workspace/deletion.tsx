"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Workspace } from "@/lib/api/types";
import { formatDate } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

/** Settings › General, owner only: delete the workspace after typing its name; 30 days to change one's mind. */
export function DeleteWorkspaceCard() {
  const t = useTranslations("deletion");
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-danger/40">
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody>
        <Button variant="outline" className="text-danger" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          {t("open")}
        </Button>
        {open ? <DeleteDialog onClose={() => setOpen(false)} /> : null}
      </CardBody>
    </Card>
  );
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deletion");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [name, setName] = useState("");
  const matches = name === workspace.name;
  const remove = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/deletion", { params: { path: { workspaceId: workspace.id } }, body: { confirmName: name } })),
    onSuccess: (ws) => {
      toast.success(t("scheduledToast", { date: ws.deletionScheduledFor ? formatDate(ws.deletionScheduledFor) : "" }));
      router.replace("/workspaces?all=1");
      router.refresh();
    },
  });
  const error = remove.error instanceof ApiError && remove.error.code === "tenancy.deletion.confirm_mismatch" ? t("mismatch") : remove.error ? errorMessage(remove.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches) remove.mutate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("confirmTitle", { name: workspace.name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="delete-workspace" variant="danger" loading={remove.isPending} disabled={!matches}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <form id="delete-workspace" onSubmit={submit} className="space-y-4" noValidate>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>{t("effect1")}</li>
          <li>{t("effect2")}</li>
          <li>{t("effect3")}</li>
        </ul>
        <Field label={t("typeName", { name: workspace.name })} htmlFor="confirm-name" error={error}>
          <Input id="confirm-name" dir="auto" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error) || undefined} />
        </Field>
      </form>
    </Dialog>
  );
}

/** What a workspace scheduled for deletion shows instead of the panel: the date, and a cancel button for its owner. */
export function PendingDeletionPage({ workspace }: { workspace: Workspace }) {
  const t = useTranslations("deletion");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const owner = workspace.role === "owner";
  const cancel = useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.DELETE("/api/v1/workspaces/{workspaceId}/deletion", { params: { path: { workspaceId: workspace.id } } });
      return unwrap({ data, error, response });
    },
    onSuccess: () => {
      toast.success(t("restored"));
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <Logo />
      <Card>
        <CardBody className="space-y-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
            <CalendarClock className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{t("pendingTitle", { name: workspace.name })}</h1>
            <p className="text-sm text-muted-foreground">
              {workspace.deletionScheduledFor ? t("pendingBody", { date: formatDate(workspace.deletionScheduledFor) }) : t("pendingBodyNoDate")}
            </p>
          </div>
          {owner ? (
            <Button onClick={() => cancel.mutate()} loading={cancel.isPending}>
              <Undo2 aria-hidden />
              {t("cancel")}
            </Button>
          ) : (
            <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("ownerOnly")}</p>
          )}
        </CardBody>
      </Card>
      <Link href="/workspaces?all=1" className={buttonVariants({ variant: "outline" })}>
        {t("otherWorkspaces")}
      </Link>
    </main>
  );
}
