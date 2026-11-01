"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { KnowledgeSource } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { limits, useSaveSource } from "./data";

/** Add or edit a FAQ entry (question + answer) or a text source (title + body). Saving re-indexes it. */
export function SourceDialog({ kind, source, prefill, onClose }: { kind: "faq" | "text"; source: KnowledgeSource | null; prefill?: { first: string; second: string }; onClose: () => void }) {
  const t = useTranslations("knowledge.editor");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const save = useSaveSource(workspace.id);
  const faq = kind === "faq";
  // A FAQ's answer comes back as the source body; its title is the question.
  const [first, setFirst] = useState(prefill?.first ?? (faq ? (source?.question ?? source?.title ?? "") : (source?.title ?? "")));
  const [second, setSecond] = useState(prefill?.second ?? source?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstMax = faq ? limits.question : limits.title;
  const secondMax = faq ? limits.answer : limits.body;
  const firstKey = faq ? "question" : "title";
  const secondKey = faq ? "answer" : "body";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const a = first.trim();
    const b = second.trim();
    save.mutate(
      { id: source?.id ?? null, input: faq ? { kind: "faq", question: a, answer: b } : { kind: "text", title: a, body: b } },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 400) {
            const next: Record<string, string> = {};
            for (const f of [firstKey, secondKey, "title"]) {
              const code = err.field(f);
              if (code) next[f === "title" && faq ? firstKey : f] = codeMessage(code) ?? t(`invalid.${f}` as "invalid.title");
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
      variant="sheet"
      className="max-w-2xl"
      title={t(`${source ? "edit" : "new"}.${kind}`)}
      description={t("reindexNote")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="kb-source-form" loading={save.isPending} disabled={!first.trim() || !second.trim()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="kb-source-form" onSubmit={submit} className="space-y-4">
        <Field label={t(firstKey)} htmlFor="kb-first" error={errors[firstKey]} hint={faq ? t("questionHint") : undefined}>
          <Input id="kb-first" dir="auto" maxLength={firstMax} value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
        </Field>
        <Field label={t(secondKey)} htmlFor="kb-second" error={errors[secondKey]} hint={t("count", { n: toPersianDigits(second.length), max: toPersianDigits(secondMax) })}>
          <Textarea id="kb-second" dir="auto" maxLength={secondMax} className={faq ? "min-h-28" : "min-h-64"} value={second} onChange={(e) => setSecond(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
