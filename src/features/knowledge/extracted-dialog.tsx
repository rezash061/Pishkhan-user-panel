"use client";

import { FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { KnowledgeSource } from "@/lib/api/types";
import { maxUploadBytes, uploadFile, waitUntilScanned } from "@/lib/api/upload";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { limits, useSaveSource } from "./data";

const accept = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

type Phase = "idle" | "uploading" | "scanning" | "saving";

/**
 * Add a document (PDF, Word or text, up to 20 MB) or a web page; the backend reads its text in the background.
 * Editing changes only the title, and for a page its address (which reads the page again).
 */
export function ExtractedSourceDialog({ kind, source, onClose }: { kind: "file" | "url"; source: KnowledgeSource | null; onClose: () => void }) {
  const t = useTranslations("knowledge.extracted");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const save = useSaveSource(workspace.id);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(source?.url ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = phase !== "idle";
  const isFile = kind === "file";
  const ready = isFile ? Boolean(source || file) : Boolean(url.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const cleanTitle = title.trim();
    try {
      if (isFile) {
        if (source) {
          await save.mutateAsync({ id: source.id, input: { kind: "file", title: cleanTitle || null, fileId: source.fileId ?? "" } });
        } else {
          if (!file) return;
          if (file.size > maxUploadBytes.knowledge_document) return setErrors({ file: t("tooLarge") });
          setPhase("uploading");
          const uploaded = await uploadFile(workspace.id, "knowledge_document", file);
          setPhase("scanning");
          const clean = await waitUntilScanned(workspace.id, uploaded.id);
          setPhase("saving");
          await save.mutateAsync({ id: null, input: { kind: "file", title: cleanTitle || null, fileId: clean.id } });
        }
      } else {
        setPhase("saving");
        await save.mutateAsync({ id: source?.id ?? null, input: { kind: "url", title: cleanTitle || null, url: url.trim() } });
      }
      toast.success(t(source ? "saved" : "added"));
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 413 || err.status === 415)) {
        const next: Record<string, string> = {};
        for (const [f, key] of [["title", "title"], ["url", "url"], ["fileId", "file"], ["file", "file"], ["body", "url"]] as const) {
          const code = err.field(f);
          if (code) next[key] = codeMessage(code) ?? errorMessage(err);
        }
        if (!Object.keys(next).length && isFile && err.status !== 400) next.file = errorMessage(err);
        if (Object.keys(next).length) return setErrors(next);
      }
      toast.error(errorMessage(err));
    } finally {
      setPhase("idle");
    }
  };

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : onClose}
      variant="sheet"
      title={t(`${source ? "edit" : "new"}.${kind}`)}
      description={t(`hint.${kind}`)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="kb-extracted-form" loading={busy} disabled={!ready}>
            {busy ? t(`phase.${phase}`) : t("save")}
          </Button>
        </>
      }
    >
      <form id="kb-extracted-form" onSubmit={submit} className="space-y-4">
        {isFile && !source ? (
          <div className="space-y-1.5">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center hover:border-primary/50 has-[:focus-visible]:border-primary">
              <FileUp className="size-8 text-primary" aria-hidden />
              <span className="text-sm font-medium" dir="auto">
                {file ? file.name : t("pick")}
              </span>
              <span className="text-xs text-muted-foreground">{t("pickHint")}</span>
              <input
                type="file"
                accept={accept}
                className="sr-only"
                aria-label={t("pick")}
                disabled={busy}
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  setErrors({});
                  setFile(picked);
                }}
              />
            </label>
            {errors.file ? (
              <p className="text-sm text-danger" role="alert">
                {errors.file}
              </p>
            ) : null}
          </div>
        ) : null}
        {!isFile ? (
          <Field label={t("url")} htmlFor="kb-url" error={errors.url} hint={t("urlHint")}>
            <Input id="kb-url" type="url" dir="ltr" inputMode="url" placeholder="https://" maxLength={limits.url} value={url} onChange={(e) => setUrl(e.target.value)} autoFocus disabled={busy} />
          </Field>
        ) : null}
        <Field label={t("title")} htmlFor="kb-title" error={errors.title} hint={source ? undefined : t(`titleHint.${kind}`)}>
          <Input id="kb-title" dir="auto" maxLength={limits.title} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} autoFocus={isFile && Boolean(source)} />
        </Field>
        {source && !isFile ? <p className="text-xs text-muted-foreground">{t("refetchNote")}</p> : null}
      </form>
    </Dialog>
  );
}
